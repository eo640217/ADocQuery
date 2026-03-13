import { openai } from "@/lib/openai";

type Chunk = {
    id: string;
    content: string;
    documentId: string;
    documentName?: string;
    chunkIndex: number;
    pageNumber?: number | null;
    distance?: number | null;
};

export async function rerankChunks(
    question: string,
    chunks: Chunk[]
): Promise<Chunk[]> {
    if (chunks.length <= 1) return chunks;

    const numberedChunks = chunks
        .map((chunk, index) => {
            return `Chunk ${index + 1}
Document: ${chunk.documentName ?? chunk.documentId}
Page: ${chunk.pageNumber ?? "?"}
Chunk Index: ${chunk.chunkIndex}
Content:
${chunk.content}`;
        })
        .join("\n\n---\n\n");

    const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
            {
                role: "system",
                content: `
You are ranking document chunks for relevance to a user's contract question.
Return only a comma-separated list of chunk numbers in best-to-worst order.
Example: 2,1,3,4
Do not explain.
                `.trim(),
            },
            {
                role: "user",
                content: `
Question:
${question}

Chunks:
${numberedChunks}
                `.trim(),
            },
        ],
    });

    const raw = response.output_text.trim();

    const rankedIndexes = raw
        .split(",")
        .map((item) => parseInt(item.trim(), 10) - 1)
        .filter((index) => !Number.isNaN(index) && index >= 0 && index < chunks.length);

    const seen = new Set<number>();
    const ranked = rankedIndexes
        .filter((index) => {
            if (seen.has(index)) return false;
            seen.add(index);
            return true;
        })
        .map((index) => chunks[index]);

    const leftovers = chunks.filter((_, index) => !seen.has(index));

    return [...ranked, ...leftovers];
}
