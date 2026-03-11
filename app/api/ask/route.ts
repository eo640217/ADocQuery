import { retrieveRelevantChunks } from "@/lib/retrieve";
import { openai } from "@/lib/openai";
import { buildContext } from "@/lib/buildContext";

const MAX_CONTEXT_LENGTH = 3000;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function formatChatHistory(chatHistory: ChatMessage[] = [], maxMessages = 6) {
  return chatHistory
    .slice(-maxMessages)
    .map((message) => {
      const label = message.role === "user" ? "User" : "Assistant";
      return `${label}: ${message.content}`;
    })
    .join("\n\n");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { documentId, question, chatHistory } = body as {
      documentId?: string;
      question?: string;
      chatHistory?: ChatMessage[];
    };

    if (!documentId?.trim() || !question?.trim()) {
      return new Response(
        JSON.stringify({ error: "documentId and question are required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const chunks = await retrieveRelevantChunks(documentId, question, 5);

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I couldn’t find relevant contract text for that question.",
          sources: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { context, usedChunks } = buildContext(chunks, MAX_CONTEXT_LENGTH);
    const formattedHistory = formatChatHistory(chatHistory || []);

    const stream = await openai.responses.create({
      model: "gpt-4.1-mini",
      stream: true,
      input: [
        {
          role: "system",
          content: `
You are a contract analysis assistant.
Answer the user's question using only the provided contract context and recent conversation history.
Use the conversation history only to understand references like "it", "that clause", or follow-up questions.
Do not make up facts or rely on outside knowledge.
If the answer is not clearly supported by the context, say: "The contract text provided does not clearly answer that."
When possible, mention the relevant page numbers from the context.
Be precise and concise.
          `.trim(),
        },
        {
          role: "user",
          content: `
Recent conversation:
${formattedHistory || "No prior conversation."}

Current question:
${question}

Contract context:
${context}
          `.trim(),
        },
      ],
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        send({
          type: "sources",
          sources: usedChunks.map((chunk) => ({
            id: chunk.id,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            contentPreview: chunk.content.replace(/\s+/g, " ").slice(0, 200),
            distance: chunk.distance,
          })),
        });

        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              send({
                type: "token",
                token: event.delta,
              });
            }

            if (event.type === "response.completed") {
              send({ type: "done" });
            }
          }
        } catch (err) {
          console.error("Streaming error:", err);
          send({
            type: "error",
            error: "Streaming failed.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Ask failed." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}