"use client";

import { useEffect, useState } from "react";

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

function toConfidenceLabel(distance?: number | null) {
  if (distance === undefined || distance === null) {
    return null;
  }

  if (distance <= 0.2) {
    return "Strong match";
  }

  if (distance <= 0.35) {
    return "Good match";
  }

  return "Possible match";
}

function formatPageNumber(pageNumber?: number | null) {
  if (!pageNumber || pageNumber < 1) {
    return "Page not detected";
  }

  return `Page ${pageNumber}`;
}

export default function AskBox({ documentId, documentName }: AskBoxProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [scope, setScope] = useState<"document" | "workspace">("document");
  const [rewrittenQuery, setRewrittenQuery] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const currentlyViewingLabel =
    scope === "workspace" ? "All uploaded documents" : documentName;
  const suggestedQuestions = [
    "Which document mentions payment within 15 days?",
    "Compare termination clauses across all uploaded contracts.",
    "Summarize notice periods and renewal terms.",
  ];
  const groupedSources = sources.reduce<Record<string, Source[]>>((acc, source) => {
    const key = source.documentName?.trim() || "Uploaded document";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(source);
    return acc;
  }, {});
  const groupedEntries = Object.entries(groupedSources);

  useEffect(() => {
    setAnswer("");
    setSources([]);
    setErrorMessage("");
    setRewrittenQuery("");
    setQuestion("");
  }, [documentId, scope]);

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
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-sm transition-shadow hover:shadow-md">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="order-2 lg:order-1">
          <div className="mb-6 rounded-lg border border-blue-800 bg-blue-950/30 p-4">
            <p className="text-sm text-blue-300">Currently viewing:</p>
            <p className="text-lg font-semibold text-blue-100">{currentlyViewingLabel}</p>
          </div>

          <h2 className="mb-2 text-2xl font-bold text-slate-100">
            Ask about the contract
          </h2>
          <p className="mb-6 text-slate-300">
            Ask follow-up questions and keep the conversation going
          </p>

          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Demo prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm font-semibold text-slate-300">Search scope</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScope("document")}
                className={`rounded-lg px-3 py-2 text-sm font-medium border ${
                  scope === "document"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-700 bg-slate-900 text-slate-200"
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
                    : "border-slate-700 bg-slate-900 text-slate-200"
                }`}
              >
                All documents
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {scope === "workspace"
                ? "Workspace mode is best for cross-document comparisons."
                : "Document mode focuses answers on the selected file only."}
            </p>
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something about the contract..."
            className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 font-medium text-slate-100 placeholder-slate-500 transition-colors focus:border-blue-500 focus:bg-slate-900 focus:outline-none"
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
            <div className="mt-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {rewrittenQuery && (
            <div className="mt-4 rounded-lg border border-amber-700 bg-amber-950/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
                Retrieval Query
              </p>
              <p className="mt-1 text-sm text-amber-100">{rewrittenQuery}</p>
            </div>
          )}

          {(answer || loading) && (
            <div className="mt-8 rounded-lg border border-blue-800 bg-blue-950/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-blue-100">Latest Answer</h3>
                {answer && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(answer)}
                    className="rounded-md border border-blue-700 bg-blue-950/50 px-2 py-1 text-xs font-semibold text-blue-100 transition-colors hover:bg-blue-900"
                  >
                    Copy
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-blue-100">
                {answer || (loading ? "Thinking..." : "")}
              </p>
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 text-lg font-semibold text-slate-100">
                Evidence from your documents
              </h3>
              <p className="mb-4 text-sm text-slate-300">
                These snippets are the passages used to produce the answer.
              </p>

              <div className="space-y-4">
                {groupedEntries.map(([docName, docSources]) => (
                  <div key={docName} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-100">{docName}</p>
                      <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">
                        {docSources.length} snippet{docSources.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {docSources.map((source, index) => {
                        const confidenceLabel = toConfidenceLabel(source.distance);

                        return (
                          <div
                            key={source.id}
                            className="rounded-lg border border-slate-700 bg-slate-800/70 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                                Source {index + 1} · {formatPageNumber(source.pageNumber)}
                              </p>

                              {confidenceLabel && (
                                <span className="rounded-full border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200">
                                  {confidenceLabel}
                                </span>
                              )}
                            </div>

                            <p className="rounded-md border border-slate-700 bg-slate-900 p-3 text-sm leading-relaxed text-slate-200">
                              “{source.contentPreview}”
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <aside className="order-1 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Conversation
              </h3>
              <button
                type="button"
                onClick={() => setChatHistory([])}
                disabled={chatHistory.length === 0}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </div>

            {chatHistory.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">
                Your conversation will appear here after the first question.
              </p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-2">
                {chatHistory.map((message, index) => (
                  <div
                    key={index}
                    className={`rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-slate-900 border border-slate-700"
                        : "bg-blue-950/30 border border-blue-800"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {message.role === "user" ? "You" : "Assistant"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-200">
                      {message.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}