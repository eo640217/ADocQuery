import { db } from "@/lib/db";
import { mkdir, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { ingestDocumentChunks } from "@/lib/ingest";

PDFParse.setWorker(getPath());

export async function POST(req: Request) {
  try {
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