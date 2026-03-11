import { db } from "@/lib/db";

export type SearchResult = {
  id: string;
  content: string;
  documentId: string;
  chunkIndex: number;
  score: number;
};

export async function searchSimilarChunks(
  embedding: number[],
  limit = 5
) {
  const result = await db.$queryRawUnsafe(
    `
    SELECT 
      id,
      content,
      "documentId",
      "chunkIndex",
      1 - (embedding <-> $1::vector) AS score
    FROM "DocumentChunk"
    ORDER BY embedding <-> $1::vector
    LIMIT ${limit}
    `,
    `[${embedding.join(",")}]`
  );

  return result as {
    id: string;
    content: string;
    documentId: string;
    chunkIndex: number;
    score: number;
  }[];
}