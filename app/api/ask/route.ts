import { retrieveRelevantChunks } from "@/lib/retrieve";
import { retrieveRelevantChunksAcrossWorkspace } from "@/lib/retrieveWorkspace";
import { openai } from "@/lib/openai";
import { buildContext } from "@/lib/buildContext";
import { rewriteQuery } from "@/lib/rewriteQuery";
import { rerankChunks } from "@/lib/rerankChunks";
import { checkRateLimit, getClientIp, readIntEnv } from "@/lib/demoGuards";

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
    const ip = getClientIp(req);
    const askLimit = readIntEnv("DEMO_ASKS_PER_WINDOW", 40);
    const askWindowMs = readIntEnv("DEMO_ASK_WINDOW_MS", 10 * 60 * 1000);

    const askRate = checkRateLimit(`ask:${ip}`, askLimit, askWindowMs);
    if (!askRate.ok) {
      return new Response(
        JSON.stringify({
          error: `Question rate limit exceeded. Try again in ${askRate.retryAfterSeconds}s.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(askRate.retryAfterSeconds),
          },
        }
      );
    }

    const body = await req.json();
    const { documentId, question, chatHistory, scope } = body as {
      documentId?: string;
      question?: string;
      chatHistory?: ChatMessage[];
      scope?: "document" | "workspace";
    };

    if (!question?.trim()) {
      return new Response(
        JSON.stringify({ error: "question is required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const maxQuestionLength = readIntEnv("DEMO_MAX_QUESTION_LENGTH", 600);
    if (question.trim().length > maxQuestionLength) {
      return new Response(
        JSON.stringify({
          error: `Question is too long for this demo (max ${maxQuestionLength} characters).`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if ((scope ?? "document") === "document" && !documentId?.trim()) {
      return new Response(
        JSON.stringify({ error: "documentId is required for document scope." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const rewrittenQuery = await rewriteQuery(question, chatHistory || []);

    const initialChunks =
      (scope ?? "document") === "workspace"
        ? await retrieveRelevantChunksAcrossWorkspace(rewrittenQuery, 8)
        : await retrieveRelevantChunks(documentId!, rewrittenQuery, 8);

    if (initialChunks.length === 0) {
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

    const rerankedChunks = await rerankChunks(question, initialChunks);
    const finalChunks = rerankedChunks.slice(0, 5);

    const { context, usedChunks } = buildContext(finalChunks, MAX_CONTEXT_LENGTH);
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
The context may come from one document or multiple documents.
If multiple documents are relevant, clearly distinguish them.
Do not make up facts or rely on outside knowledge.
If the answer is not clearly supported by the context, say: "The contract text provided does not clearly answer that."
When possible, mention document names and page numbers.
Be precise and concise.
          `.trim(),
        },
        {
          role: "user",
          content: `
Recent conversation:
${formattedHistory || "No prior conversation."}

Retrieval mode:
${scope === "workspace" ? "All uploaded documents" : "Single selected document"}

Rewritten retrieval query:
${rewrittenQuery}

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
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            contentPreview: chunk.content.replace(/\s+/g, " ").slice(0, 200),
            distance: chunk.distance,
          })),
        });

        send({
          type: "meta",
          rewrittenQuery,
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