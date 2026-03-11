import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function generateAnswer(
  question: string,
  context: string
) {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You answer questions using the provided context. If the answer is not in the context, say you don't know.",
      },
      {
        role: "user",
        content: `
Context:
${context}

Question:
${question}
`,
      },
    ],
  });

  return response.choices[0].message.content;
}