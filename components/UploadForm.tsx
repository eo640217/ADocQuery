"use client";

import { useState } from "react";

type UploadFormProps = {
  onUploadSuccess: (documentId: string, documentName: string) => void;
};

export default function UploadForm({ onUploadSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a PDF.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setMessage("");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setMessage(`Uploaded successfully: ${data.document.originalName}`);
      setFile(null);
      onUploadSuccess(data.document.id, data.document.originalName);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
    
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
      <h2 className="mb-2 text-2xl font-bold text-slate-900">Upload a contract PDF</h2>
      <p className="mb-6 text-slate-600">Choose a PDF file to analyze and ask questions about</p>

      <div className="mb-6 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center transition-colors hover:border-slate-400">
        <svg
          className="mx-auto mb-2 h-8 w-8 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <span className="block text-sm font-medium text-slate-900">
            {file ? file.name : "Click to select a PDF or drag and drop"}
          </span>
          <span className="block text-xs text-slate-500">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF files only"}
          </span>
        </label>
      </div>

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all disabled:opacity-50 enabled:hover:bg-blue-700 enabled:active:scale-95"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            Uploading...
          </span>
        ) : (
          "Upload PDF"
        )}
      </button>

      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm ${
          message.includes("successfully")
            ? "bg-green-50 text-green-800"
            : "bg-red-50 text-red-800"
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}