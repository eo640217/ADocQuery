import { NextResponse } from "next/server";
import { retrieveRelevantChunks } from "@/lib/retrieve";
import { openai } from "@/lib/openai";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { documentId, question } = body as {
            documentId?: string;
            question?: string;
        };

        if (!documentId || !question) {
            return NextResponse.json(
                { error: "documentId and question are required." },
                { status: 400 }
            );
        }

        const chunks = await retrieveRelevantChunks(documentId, question, 5);

        if (chunks.length === 0) {
            return NextResponse.json({
                answer: "I couldn’t find relevant contract text for that question.",
                sources: [],
            });
        }

        const context = chunks
            .map(
                (chunk) =>
                    `[Page ${chunk.pageNumber}, Chunk ${chunk.chunkIndex}]\n${chunk.content}`
            )
            .join("\n\n---\n\n");

        const response = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [
                {
                    role: "system",
                    content: `
You are a contract analysis assistant.
Answer the user's question using only the provided contract context.
If the answer is not clearly supported by the context, say that the contract text provided does not clearly answer it.
Be precise and concise.
          `.trim(),
                },
                {
                    role: "user",
                    content: `
Question:
${question}

Contract context:
${context}
          `.trim(),
                },
            ],
        });

        const answer = response.output_text;

        return NextResponse.json({
            answer,
            sources: chunks.map((chunk) => ({
                id: chunk.id,
                chunkIndex: chunk.chunkIndex,
                pageNumber: chunk.pageNumber,
                contentPreview: chunk.content.slice(0, 200),
                distance: chunk.distance,
            })),
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Ask failed." }, { status: 500 });
    }
}