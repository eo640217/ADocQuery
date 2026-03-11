"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import AskBox from "@/components/AskBox";

export default function HomePage() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-4xl font-bold text-slate-900">DocQuery - Turn Documents Into Answers</h1>
          <p className="text-lg text-slate-600">Upload a PDF and ask questions about its contents</p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {!documentId && (
            <UploadForm
              onUploadSuccess={(id, name) => {
                setDocumentId(id);
                setDocumentName(name);
              }}
            />
          )}

          {documentId && documentName && (
            <div>
              <AskBox documentId={documentId} documentName={documentName} />
              <button
                onClick={() => {
                  setDocumentId(null);
                  setDocumentName(null);
                }}
                className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Upload Another Document
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}