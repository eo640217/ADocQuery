export function chunkText(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end === normalized.length) break;

    start += chunkSize - overlap;
  }

  return chunks;
}

export function chunkPages(
  pages: { pageNumber: number; text: string }[],
  chunkSize = 1000,
  overlap = 200
) {
  const pageChunks: {
    pageNumber: number;
    content: string;
  }[] = [];

  for (const page of pages) {
    const chunks = chunkText(page.text, chunkSize, overlap);

    for (const chunk of chunks) {
      pageChunks.push({
        pageNumber: page.pageNumber,
        content: chunk,
      });
    }
  }

  return pageChunks;
}