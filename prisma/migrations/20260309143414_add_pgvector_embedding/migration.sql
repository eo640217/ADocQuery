CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "DocumentChunk"
ADD COLUMN embedding vector(1536);

CREATE INDEX document_chunk_embedding_hnsw_idx
ON "DocumentChunk"
USING hnsw (embedding vector_cosine_ops);