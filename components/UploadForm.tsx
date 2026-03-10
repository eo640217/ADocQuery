"use client";

import { useState } from "react";

type UploadFormProps = {
  onUploadSuccess: (documentId: string) => void;
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
      onUploadSuccess(data.document.id);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
    
  };

  return (
    <div className="max-w-xl rounded-2xl border p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Upload a contract PDF</h2>

      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4 block w-full"
      />

      <button
        onClick={handleUpload}
        disabled={loading}
        className="rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload PDF"}
      </button>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  );
}