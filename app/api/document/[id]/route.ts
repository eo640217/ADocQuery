import { db } from "@/lib/db";
import { NextResponse } from "next/server";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;

    const [document, chunkStats] = await Promise.all([
      db.document.findUnique({
        where: { id },
        select: {
          id: true,
          originalName: true,
          status: true,
          pageCount: true,
          createdAt: true,
        },
      }),
      db.$queryRawUnsafe<{ total: number; indexed: number }[]>(
        `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS indexed
        FROM "DocumentChunk"
        WHERE "documentId" = $1
        `,
        id
      ),
    ]);

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    const row = chunkStats[0] || { total: 0, indexed: 0 };

    return NextResponse.json({
      document,
      chunkCount: row.total,
      indexedChunkCount: row.indexed,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to read document status." }, { status: 500 });
  }
}
