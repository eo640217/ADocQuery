import { db } from "@/lib/db";
import { mkdir, unlink, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { ingestDocumentChunks } from "@/lib/ingest";
import { checkRateLimit, getClientIp, readIntEnv } from "@/lib/demoGuards";

PDFParse.setWorker(getPath());

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const uploadLimit = readIntEnv("DEMO_UPLOADS_PER_WINDOW", 5);
    const uploadWindowMs = readIntEnv("DEMO_UPLOAD_WINDOW_MS", 10 * 60 * 1000);

    const uploadRate = checkRateLimit(`upload:${ip}`, uploadLimit, uploadWindowMs);
    if (!uploadRate.ok) {
      return NextResponse.json(
        {
          error: `Upload rate limit exceeded. Try again in ${uploadRate.retryAfterSeconds}s.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(uploadRate.retryAfterSeconds),
          },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 10MB." },
        { status: 400 }
      );
    }

    const maxDocuments = readIntEnv("DEMO_MAX_DOCUMENTS", 100);
    const documentCount = await db.document.count();
    if (documentCount >= maxDocuments) {
      return NextResponse.json(
        {
          error: `Upload limit reached for this demo (${maxDocuments} documents). Please clean up old files.`,
        },
        { status: 403 }
      );
    }

    const existingByName = await db.document.findFirst({
      where: {
        originalName: {
          equals: file.name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingByName) {
      return NextResponse.json(
        {
          error: "A document with the same filename already exists.",
        },
        { status: 409 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${uuidv4()}-${file.name}`;
    const filePath = path.join(uploadsDir, fileName);

    await writeFile(filePath, buffer);

    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const result = await parser.getText();

    const extractedText = result.text;
    const pageCount = result.total;

    const maxExtractedChars = readIntEnv("DEMO_MAX_EXTRACTED_CHARS", 300000);
    if (extractedText.length > maxExtractedChars) {
      await unlink(filePath).catch(() => undefined);
      return NextResponse.json(
        {
          error: `PDF text is too large for this demo (max ${maxExtractedChars} characters).`,
        },
        { status: 400 }
      );
    }

    await parser.destroy();


    const document = await db.document.create({
      data: {
        originalName: file.name,
        storagePath: filePath,
        mimeType: file.type,
        size: file.size,
        status: "PROCESSING",
        extractedText,
        pageCount,
      },
    });

    const chunkCount = await ingestDocumentChunks(document.id, extractedText, pageCount);

    await db.document.update({
      where: { id: document.id },
      data: { status: "PROCESSED" },
    });

    return NextResponse.json({
      success: true,
      document,
      chunkCount,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}