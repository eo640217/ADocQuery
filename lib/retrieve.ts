import { db } from "@/lib/db";
import { embedText } from "@/lib/embeddings";

type RetrievedChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  distance: number | null;
  vectorScore: number;
  textScore: number;
  hybridScore: number;
};

const VECTOR_WEIGHT = 0.7;
const TEXT_WEIGHT = 0.3;
const VECTOR_CANDIDATES = 60;
const FTS_CANDIDATES = 60;

export async function retrieveRelevantChunks(
  documentId: string,
  question: string,
  limit = 5
): Promise<RetrievedChunk[]> {
  const questionEmbedding = await embedText(question);
  const embeddingSql = `[${questionEmbedding.join(",")}]`;

  const results = await db.$queryRawUnsafe<RetrievedChunk[]>(
    `
    WITH vector_hits AS (
      SELECT
        dc.id,
        dc.embedding <=> $1::vector AS distance,
        GREATEST(0.0, 1 - (dc.embedding <=> $1::vector)) AS vector_score
      FROM "DocumentChunk" dc
      WHERE dc."documentId" = $2
        AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $4
    ),
    fts_hits AS (
      SELECT
        dc.id,
        ts_rank_cd(dc.content_tsv, websearch_to_tsquery('english', $3)) AS text_score
      FROM "DocumentChunk" dc
      WHERE dc."documentId" = $2
        AND dc.content_tsv @@ websearch_to_tsquery('english', $3)
      ORDER BY text_score DESC
      LIMIT $5
    ),
    combined AS (
      SELECT
        COALESCE(vh.id, fh.id) AS id,
        vh.distance,
        COALESCE(vh.vector_score, 0.0) AS vector_score,
        COALESCE(fh.text_score, 0.0) AS text_score
      FROM vector_hits vh
      FULL OUTER JOIN fts_hits fh
        ON fh.id = vh.id
    )
    SELECT
      dc.id,
      dc."documentId",
      dc."chunkIndex",
      dc."pageNumber",
      dc.content,
      c.distance,
      c.vector_score AS "vectorScore",
      c.text_score AS "textScore",
      ($6 * c.vector_score) + ($7 * c.text_score) AS "hybridScore"
    FROM combined c
    JOIN "DocumentChunk" dc
      ON dc.id = c.id
    ORDER BY "hybridScore" DESC, c.distance ASC NULLS LAST
    LIMIT $8
    `,
    embeddingSql,
    documentId,
    question,
    VECTOR_CANDIDATES,
    FTS_CANDIDATES,
    VECTOR_WEIGHT,
    TEXT_WEIGHT,
    limit
  );

  return results;
}