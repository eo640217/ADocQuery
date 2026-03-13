"use client";

import { useState } from "react";

type Source = {
  id: string;
  documentId: string;
  documentName?: string;
  chunkIndex: number;
  pageNumber?: number | null;
  contentPreview: string;
  distance?: number | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AskBoxProps = {
  documentId: string;
  documentName: string;
};

export default function AskBox({ documentId, documentName }: AskBoxProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [scope, setScope] = useState<"document" | "workspace">("document");
  const [rewrittenQuery, setRewrittenQuery] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  async function askQuestion() {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    setLoading(true);
    setAnswer("");
    setRewrittenQuery("");
    setSources([]);
    setErrorMessage("");

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          question: trimmedQuestion,
          chatHistory: chatHistory.slice(-6),
          scope,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Ask request failed.");
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();

        setAnswer(data.answer || "");
        setSources(data.sources || []);

        if (data.answer) {
          setChatHistory((prev) => [
            ...prev,
            { role: "user", content: trimmedQuestion },
            { role: "assistant", content: data.answer },
          ]);
        }

        setQuestion("");
        setLoading(false);
        return;
      }

      if (!response.body) {
        throw new Error("No response body received.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";
      let didFinish = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;

          const json = event.slice(6);

          try {
            const parsed = JSON.parse(json);

            if (parsed.type === "sources") {
              setSources(parsed.sources || []);
            }

            if (parsed.type === "meta") {
              setRewrittenQuery(parsed.rewrittenQuery || "");
            }

            if (parsed.type === "token") {
              fullAnswer += parsed.token;
              setAnswer((prev) => prev + parsed.token);
            }

            if (parsed.type === "done") {
              didFinish = true;

              setChatHistory((prev) => [
                ...prev,
                { role: "user", content: trimmedQuestion },
                { role: "assistant", content: fullAnswer },
              ]);

              setQuestion("");
              setLoading(false);
            }

            if (parsed.type === "error") {
              setErrorMessage(parsed.error || "Something went wrong while streaming.");
              setLoading(false);
              didFinish = true;
            }
          } catch {
            console.error("Failed to parse stream event:", json);
          }
        }
      }

      if (!didFinish) {
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong."
      );
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-600">Currently viewing:</p>
        <p className="text-lg font-semibold text-blue-900">{documentName}</p>
      </div>

      <h2 className="mb-2 text-2xl font-bold text-slate-900">
        Ask about the contract
      </h2>
      <p className="mb-6 text-slate-600">
        Ask follow-up questions and keep the conversation going
      </p>

      {chatHistory.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Conversation
          </h3>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {chatHistory.map((message, index) => (
              <div
                key={index}
                className={`rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-white border border-slate-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {message.role === "user" ? "You" : "Assistant"}
                </p>
                <p className="whitespace-pre-wrap text-sm text-slate-800">
                  {message.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="mb-2 text-sm font-semibold text-slate-700">Search scope</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setScope("document")}
            className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              scope === "document"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            Current document
          </button>

          <button
            type="button"
            onClick={() => setScope("workspace")}
            className={`rounded-lg px-3 py-2 text-sm font-medium border ${
              scope === "workspace"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            All documents
          </button>
        </div>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask something about the contract..."
        className="mb-4 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-medium text-slate-900 placeholder-slate-500 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none"
        rows={4}
      />

      <button
        onClick={askQuestion}
        disabled={loading || !question.trim()}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all disabled:opacity-50 enabled:hover:bg-blue-700 enabled:active:scale-95"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            Analyzing...
          </span>
        ) : (
          "Ask"
        )}
      </button>

      {errorMessage && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {rewrittenQuery && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Retrieval Query
          </p>
          <p className="mt-1 text-sm text-amber-900">{rewrittenQuery}</p>
        </div>
      )}

      {(answer || loading) && (
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-3 text-lg font-semibold text-blue-900">Latest Answer</h3>
          <p className="whitespace-pre-wrap leading-relaxed text-blue-900">
            {answer || (loading ? "Thinking..." : "")}
          </p>
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Sources ({sources.length})
          </h3>

          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {source.documentName ?? "Unknown document"} • Page {source.pageNumber ?? "?"} • Chunk {source.chunkIndex}
                  </p>

                  {source.distance !== undefined && source.distance !== null && (
                    <span className="inline-block rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                      Relevance: {(1 - source.distance).toFixed(2)}
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-slate-600">
                  {source.contentPreview}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}