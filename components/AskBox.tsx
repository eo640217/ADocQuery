"use client";

import { useState } from "react";

type AskBoxProps = {
  documentId: string;
};

export default function AskBox({ documentId }: AskBoxProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          question,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ask failed");
      }

      setAnswer(data.answer);
      setSources(data.sources || []);

    } catch (err) {
      setAnswer("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl rounded-2xl border p-6 shadow-sm">

      <h2 className="mb-4 text-xl font-semibold">
        Ask about the contract
      </h2>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask something about the contract..."
        className="mb-4 w-full rounded-xl border p-3"
        rows={4}
      />

      <button
        onClick={handleAsk}
        disabled={loading}
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Ask"}
      </button>

      {answer && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Answer</h3>
          <p className="whitespace-pre-wrap">{answer}</p>
        </div>
      )}
      {sources.length > 0 && (
  <div className="mt-6">
    <h3 className="mb-2 font-semibold">Sources</h3>
    <div className="space-y-3">
      {sources.map((source) => (
        <div key={source.chunkIndex} className="rounded-xl border p-3">
          <p className="text-sm font-medium">
            Page {source.pageNumber} — Chunk {source.chunkIndex}
          </p>
          <p className="text-sm text-gray-600">
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