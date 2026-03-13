import { db } from "@/lib/db";
import { embedQuery } from "@/lib/embedQuery";

type RetrievedChunk = {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  distance: number;
  documentId: string;
  documentName: string;
};

export async function retrieveRelevantChunksAcrossWorkspace(
  question: string,
  limit = 8
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(question);

  const vector = `[${embedding.join(",")}]`;

  const results = await db.$queryRawUnsafe<RetrievedChunk[]>(
    `
    SELECT
      dc.id,
      dc.content,
      dc."chunkIndex",
      dc."pageNumber",
      dc."documentId",
      d."originalName" AS "documentName",
      dc.embedding <-> $1::vector AS distance
    FROM "DocumentChunk" dc
    JOIN "Document" d
      ON d.id = dc."documentId"
    ORDER BY dc.embedding <-> $1::vector
    LIMIT ${limit}
    `,
    vector
  );

  return results;
}
