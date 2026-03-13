type Chunk = {
  id: string;
  content: string;
  documentId: string;
  documentName?: string;
  chunkIndex: number;
  pageNumber?: number | null;
  distance?: number | null;
};

export function buildContext(chunks: Chunk[], maxChars = 3000) {
  let total = 0;
  const included: Chunk[] = [];
  const parts: string[] = [];

  for (const chunk of chunks) {
    const label = `[Document: ${chunk.documentName ?? chunk.documentId} | Page ${chunk.pageNumber ?? "?"} | Chunk ${chunk.chunkIndex}]`;
    const text = `${label}\n${chunk.content}\n\n---\n\n`;

    if (total + text.length > maxChars) break;

    parts.push(text);
    included.push(chunk);
    total += text.length;
  }

  return {
    context: parts.join(""),
    usedChunks: included,
  };
}