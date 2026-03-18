ALTER TABLE "DocumentChunk"
ADD COLUMN content_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', COALESCE(content, ''))) STORED;

CREATE INDEX document_chunk_content_tsv_gin_idx
ON "DocumentChunk"
USING gin (content_tsv);

CREATE INDEX document_chunk_document_id_chunk_index_idx
ON "DocumentChunk" ("documentId", "chunkIndex");
