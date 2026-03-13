import { openai } from "@/lib/openai";

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

export async function rewriteQuery(
  question: string,
  chatHistory: ChatMessage[] = []
) {
  const formattedHistory = formatChatHistory(chatHistory);

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `
        You rewrite follow-up questions into strong standalone retrieval queries for a contract RAG system.
        Use recent conversation only to resolve references like "it", "they", "that clause", or "this section".
Preserve the latest user question's main intent and keywords.
If the latest question is a new topic, do not carry over older topics.
        Return only the rewritten query text.
        Do not answer the question.
        Keep it concise and optimized for semantic document retrieval.
        `.trim(),
      },
      {
        role: "user",
        content: `
        Recent conversation:
        ${formattedHistory || "No prior conversation."}

        Latest user question:
        ${question}
        `.trim(),
      },
    ],
  });

  return response.output_text.trim();
}
