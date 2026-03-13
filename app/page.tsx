"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import AskBox from "@/components/AskBox";

type UploadedDocument = {
  id: string;
  name: string;
};

export default function HomePage() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const activeDocument =
    documents.find((doc) => doc.id === activeDocumentId) || null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-bold text-slate-900">
            ADocQuery - Contract Analysis
          </h1>
          <p className="text-lg text-slate-600">
            Upload PDFs and ask questions across one document or your whole workspace
          </p>
        </div>

        <div className="space-y-8">
          {!showUploadForm && (
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
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
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-xl font-bold text-slate-900">
                Uploaded Documents
              </h2>

              <div className="space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setActiveDocumentId(doc.id)}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      activeDocumentId === doc.id
                        ? "border-blue-600 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {doc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDocument && (
            <AskBox
              documentId={activeDocument.id}
              documentName={activeDocument.name}
            />
          )}
        </div>
      </div>
    </main>
  );
}