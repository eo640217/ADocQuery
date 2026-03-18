"use client";

import { useEffect, useState } from "react";
import UploadForm from "@/components/UploadForm";
import AskBox from "@/components/AskBox";

type UploadedDocument = {
  id: string;
  name: string;
  status?: string;
  indexedChunkCount?: number;
  chunkCount?: number;
};

export default function HomePage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const activeDocument =
    documents.find((doc) => doc.id === activeDocumentId) || null;

  useEffect(() => {
    const indexingDocs = documents.filter(
      (doc) => doc.status === "PROCESSING" || doc.status === "PARTIALLY_INDEXED"
    );

    if (indexingDocs.length === 0) {
      return;
    }

    const poll = async () => {
      try {
        const updates = await Promise.all(
          indexingDocs.map(async (doc) => {
            const res = await fetch(`/api/document/${doc.id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return {
              id: doc.id,
              status: data.document?.status as string | undefined,
              indexedChunkCount: data.indexedChunkCount as number | undefined,
              chunkCount: data.chunkCount as number | undefined,
            };
          })
        );

        setDocuments((prev) =>
          prev.map((doc) => {
            const update = updates.find((item) => item?.id === doc.id);
            if (!update) return doc;
            return {
              ...doc,
              status: update.status ?? doc.status,
              indexedChunkCount: update.indexedChunkCount ?? doc.indexedChunkCount,
              chunkCount: update.chunkCount ?? doc.chunkCount,
            };
          })
        );
      } catch (error) {
        console.error("Failed to poll document status:", error);
      }
    };

    const timer = setInterval(poll, 2500);
    void poll();

    return () => clearInterval(timer);
  }, [documents]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-950/40 md:p-10">
          <p className="mb-3 inline-flex rounded-full border border-cyan-800 bg-cyan-950/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
            Portfolio Demo
          </p>
          <h1 className="mb-3 text-4xl font-bold text-slate-100 md:text-5xl">
            ADocQuery: Multi-Document Contract Assistant
          </h1>
          <p className="max-w-3xl text-lg text-slate-300">
            Upload legal PDFs, run semantic search, and get grounded answers with page-level citations.
            Switch between a single document view and workspace-wide retrieval for fast comparison questions.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">RAG Pipeline</p>
              <p className="mt-1 text-sm text-slate-300">Query rewrite, vector retrieval, LLM rerank, grounded generation.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Scope Control</p>
              <p className="mt-1 text-sm text-slate-300">Search current document or all uploaded agreements.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Explainability</p>
              <p className="mt-1 text-sm text-slate-300">Shows sources, page numbers, and rewritten retrieval query.</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {!showUploadForm && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm transition-colors hover:bg-slate-800"
            >
              Upload documents
            </button>
          )}

          {showUploadForm && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
                >
                  Cancel upload
                </button>
              </div>

              <UploadForm
                existingFileNames={documents.map((doc) => doc.name)}
                onUploadSuccess={(newDocs) => {
                  setDocuments((prev) => {
                    const merged = [...prev, ...newDocs];
                    return merged;
                  });

                  if (newDocs.length > 0 && !activeDocumentId) {
                    setActiveDocumentId(newDocs[0].id);
                  }

                  setShowUploadForm(false);
                }}
              />
            </div>
          )}

          {documents.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-100">Uploaded Documents</h2>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
                  {documents.length} total
                </span>
              </div>

              <p className="mb-4 text-sm text-slate-300">
                Select one as the active document. You can still switch to workspace mode inside the assistant.
              </p>

              <div className="space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setActiveDocumentId(doc.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      activeDocumentId === doc.id
                        ? "border-blue-500 bg-blue-950/50 text-blue-100"
                        : "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate">{doc.name}</span>
                      {doc.status === "PARTIALLY_INDEXED" && (
                        <span className="shrink-0 rounded-full border border-amber-700 bg-amber-950/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                          Indexing
                        </span>
                      )}
                      {doc.status === "PROCESSED" && (
                        <span className="shrink-0 rounded-full border border-emerald-700 bg-emerald-950/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                          Ready
                        </span>
                      )}
                      {doc.status === "FAILED" && (
                        <span className="shrink-0 rounded-full border border-red-700 bg-red-950/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                          Failed
                        </span>
                      )}
                    </div>
                    {(doc.status === "PARTIALLY_INDEXED" || doc.status === "PROCESSED") &&
                      typeof doc.indexedChunkCount === "number" &&
                      typeof doc.chunkCount === "number" &&
                      doc.chunkCount > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          Search is getting ready: {doc.indexedChunkCount} of {doc.chunkCount} sections processed
                        </p>
                      )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {documents.length === 0 && !showUploadForm && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-8 text-center">
              <p className="text-lg font-semibold text-slate-100">No documents uploaded yet</p>
              <p className="mt-2 text-sm text-slate-300">
                Start by uploading contracts, then ask retrieval-heavy questions like payment terms, renewal windows, and termination clauses.
              </p>
            </div>
          )}

          {activeDocument && (
            <AskBox
              documentId={activeDocument.id}
              documentName={activeDocument.name}
            />
          )}

          <footer className="pb-4 pt-2 text-center text-xs text-slate-400">
            Built with Next.js, Prisma, pgvector, and OpenAI Responses API.
          </footer>
        </div>
      </div>
    </main>
  );
}