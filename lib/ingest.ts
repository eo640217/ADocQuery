import { db } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";

const EMBEDDING_BATCH_SIZE = 16;
const UPDATE_BATCH_SIZE = 64;

type EmbeddingUpdate = {
  id: string;
  embeddingSql: string;
};

type ProgressiveIngestResult = {
  chunkCount: number;
  indexedChunkCount: number;
  continueIndexing: () => Promise<number>;
};

type ProgressiveIngestOptions = {
  initialBatches?: number;
  onBatchIndexed?: (indexedChunkCount: number, chunkCount: number) => Promise<void> | void;
};

async function updateChunkEmbeddingsBatch(updates: EmbeddingUpdate[]) {
  if (updates.length === 0) return;

  const valuesSql = updates
    .map((_, index) => {
      const idParam = index * 2 + 1;
      const embeddingParam = index * 2 + 2;
      return `($${idParam}, $${embeddingParam}::vector)`;
    })
    .join(", ");

  const params = updates.flatMap((update) => [update.id, update.embeddingSql]);

  await db.$executeRawUnsafe(
    `
    UPDATE "DocumentChunk" dc
    SET embedding = values_table.embedding
    FROM (VALUES ${valuesSql}) AS values_table(id, embedding)
    WHERE dc.id = values_table.id
    `,
    ...params
  );
}

export async function ingestDocumentChunks(
  documentId: string,
  text: string,
  pageCount: number
) {
  const progressive = await ingestDocumentChunksProgressive(documentId, text, pageCount, {
    initialBatches: Number.MAX_SAFE_INTEGER,
  });

  await progressive.continueIndexing();

  return progressive.chunkCount;
}

export async function ingestDocumentChunksProgressive(
  documentId: string,
  text: string,
  pageCount: number,
  options: ProgressiveIngestOptions = {}
): Promise<ProgressiveIngestResult> {
  const initialBatches = Math.max(1, options.initialBatches ?? 1);
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return {
      chunkCount: 0,
      indexedChunkCount: 0,
      continueIndexing: async () => 0,
    };
  }

  const totalChunks = chunks.length;
  const chunkRows = chunks.map((content, i) => {
    const approximatePageNumber =
      Math.min(
        pageCount,
        Math.max(1, Math.ceil(((i + 1) / totalChunks) * pageCount))
      );

    return {
      documentId,
      chunkIndex: i,
      pageNumber: approximatePageNumber,
      content,
    };
  });

  await db.documentChunk.createMany({
    data: chunkRows,
  });

  const createdChunkIds = await db.documentChunk.findMany({
    where: { documentId },
    select: { id: true, chunkIndex: true },
    orderBy: { chunkIndex: "asc" },
  });

  const idByChunkIndex = new Map<number, string>(
    createdChunkIds.map((row) => [row.chunkIndex, row.id])
  );

  let indexedChunkCount = 0;
  const pendingUpdates: EmbeddingUpdate[] = [];

  const flushPendingUpdates = async () => {
    if (pendingUpdates.length === 0) return;

    const toWrite = pendingUpdates.splice(0, pendingUpdates.length);
    await updateChunkEmbeddingsBatch(toWrite);
  };

  const processEmbeddingBatch = async (start: number, end: number) => {
    const batch = chunks.slice(start, end);
    const embeddings = await embedTexts(batch);

    for (let offset = 0; offset < embeddings.length; offset++) {
      const chunkIndex = start + offset;
      const chunkId = idByChunkIndex.get(chunkIndex);
      if (!chunkId) continue;

      pendingUpdates.push({
        id: chunkId,
        embeddingSql: `[${embeddings[offset].join(",")}]`,
      });
    }

    if (pendingUpdates.length >= UPDATE_BATCH_SIZE) {
      await flushPendingUpdates();
    }

    indexedChunkCount += batch.length;
    await options.onBatchIndexed?.(indexedChunkCount, totalChunks);
  };

  let batchNumber = 0;
  let start = 0;

  while (start < chunks.length && batchNumber < initialBatches) {
    const end = Math.min(start + EMBEDDING_BATCH_SIZE, chunks.length);
    await processEmbeddingBatch(start, end);
    start = end;
    batchNumber += 1;
  }

  await flushPendingUpdates();

  const continueIndexing = async () => {
    while (start < chunks.length) {
      const end = Math.min(start + EMBEDDING_BATCH_SIZE, chunks.length);
      await processEmbeddingBatch(start, end);
      start = end;
    }

    await flushPendingUpdates();

    return indexedChunkCount;
  };

  return {
    chunkCount: chunks.length,
    indexedChunkCount,
    continueIndexing,
  };
}