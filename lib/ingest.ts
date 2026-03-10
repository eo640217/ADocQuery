import { db } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { embedText } from "@/lib/embeddings";

export async function ingestDocumentChunks(
  documentId: string,
  text: string,
  pageCount: number
) {
  const chunks = chunkText(text);
  const totalChunks = chunks.length;

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];

    // create embedding for this chunk
    const embedding = await embedText(content);

    const approximatePageNumber =
      Math.min(
        pageCount,
        Math.max(1, Math.ceil(((i + 1) / totalChunks) * pageCount))
      );

    // create the chunk row
    const created = await db.documentChunk.create({
      data: {
        documentId,
        chunkIndex: i,
        pageNumber: approximatePageNumber,
        content,
      },
    });

    // convert embedding array → vector string
    const embeddingSql = `[${embedding.join(",")}]`;

    // store the embedding using raw SQL
    await db.$executeRawUnsafe(
      `
      UPDATE "DocumentChunk"
      SET embedding = $1::vector
      WHERE id = $2
      `,
      embeddingSql,
      created.id
    );
  }

  return chunks.length;
}