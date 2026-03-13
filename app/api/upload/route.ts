import { db } from "@/lib/db";
import { NextResponse } from "next/server";

import { getPath } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { ingestDocumentChunks } from "@/lib/ingest";
import { checkRateLimit, getClientIp, readIntEnv } from "@/lib/demoGuards";

PDFParse.setWorker(getPath());

export const runtime = "nodejs";
export const maxDuration = 60;

type UploadBody = {
  blobUrl?: string;
  pathname?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
};

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

    const body = (await req.json()) as UploadBody;
    const blobUrl = body.blobUrl?.trim();
    const pathname = body.pathname?.trim() || "";
    const fileName = body.fileName?.trim() || pathname.split("/").pop() || "uploaded.pdf";
    const mimeType = body.mimeType?.trim() || "application/pdf";
    const fileSize = Number(body.size ?? 0);

    if (!blobUrl) {
      return NextResponse.json({ error: "blobUrl is required." }, { status: 400 });
    }

    if (mimeType !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: "Invalid file size." }, { status: 400 });
    }

    if (fileSize > MAX_SIZE) {
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

    const pdfResponse = await fetch(blobUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "Failed to read uploaded file from Blob storage." },
        { status: 502 }
      );
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const parser = new PDFParse({ data: Buffer.from(arrayBuffer) });
    const result = await parser.getText();

    const extractedText = result.text;
    const pageCount = result.total;

    const maxExtractedChars = readIntEnv("DEMO_MAX_EXTRACTED_CHARS", 300000);
    if (extractedText.length > maxExtractedChars) {
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
        originalName: fileName,
        storagePath: blobUrl,
        mimeType,
        size: fileSize,
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
      blob: {
        url: blobUrl,
        pathname,
      },
      document,
      chunkCount,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}