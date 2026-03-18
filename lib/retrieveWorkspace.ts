import { db } from "@/lib/db";
import { embedQuery } from "@/lib/embedQuery";

type RetrievedChunk = {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  distance: number | null;
  vectorScore: number;
  textScore: number;
  hybridScore: number;
  documentId: string;
  documentName: string;
};

const VECTOR_WEIGHT = 0.7;
const TEXT_WEIGHT = 0.3;
const VECTOR_CANDIDATES = 80;
const FTS_CANDIDATES = 80;

export async function retrieveRelevantChunksAcrossWorkspace(
  question: string,
  limit = 8
): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(question);

  const vector = `[${embedding.join(",")}]`;

  const results = await db.$queryRawUnsafe<RetrievedChunk[]>(
    `
    WITH vector_hits AS (
      SELECT
        dc.id,
        dc.embedding <=> $1::vector AS distance,
        GREATEST(0.0, 1 - (dc.embedding <=> $1::vector)) AS vector_score
      FROM "DocumentChunk" dc
      WHERE dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $3
    ),
    fts_hits AS (
      SELECT
        dc.id,
        ts_rank_cd(dc.content_tsv, websearch_to_tsquery('english', $2)) AS text_score
      FROM "DocumentChunk" dc
      WHERE dc.content_tsv @@ websearch_to_tsquery('english', $2)
      ORDER BY text_score DESC
      LIMIT $4
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
      dc.content,
      dc."chunkIndex",
      dc."pageNumber",
      dc."documentId",
      d."originalName" AS "documentName",
      c.distance,
      c.vector_score AS "vectorScore",
      c.text_score AS "textScore",
      ($5 * c.vector_score) + ($6 * c.text_score) AS "hybridScore"
    FROM combined c
    JOIN "DocumentChunk" dc
      ON dc.id = c.id
    JOIN "Document" d
      ON d.id = dc."documentId"
    ORDER BY "hybridScore" DESC, c.distance ASC NULLS LAST
    LIMIT $7
    `,
    vector,
    question,
    VECTOR_CANDIDATES,
    FTS_CANDIDATES,
    VECTOR_WEIGHT,
    TEXT_WEIGHT,
    limit
  );

  return results;
}
