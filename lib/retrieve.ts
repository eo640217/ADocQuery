import { db } from "@/lib/db";
import { embedText } from "@/lib/embeddings";

type RetrievedChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  content: string;
  distance: number;
};

export async function retrieveRelevantChunks(
  documentId: string,
  question: string,
  limit = 5
): Promise<RetrievedChunk[]> {
  const questionEmbedding = await embedText(question);
  const embeddingSql = `[${questionEmbedding.join(",")}]`;

  const results = await db.$queryRawUnsafe<RetrievedChunk[]>(
    `
    SELECT
      id,
      "documentId",
      "chunkIndex",
      "pageNumber",
      content,
      embedding <=> $1::vector AS distance
    FROM "DocumentChunk"
    WHERE "documentId" = $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3
    `,
    embeddingSql,
    documentId,
    limit
  );

  return results;
}