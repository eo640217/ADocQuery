"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

const MAX_FILES_PER_UPLOAD = 5;

type UploadedDocument = {
  id: string;
  name: string;
};

type UploadFormProps = {
  onUploadSuccess: (documents: UploadedDocument[]) => void;
  existingFileNames: string[];
};

export default function UploadForm({
  onUploadSuccess,
  existingFileNames,
}: UploadFormProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const removeFile = (indexToRemove: number) => {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage("Please select at least one PDF.");
      return;
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      setMessage(`You can upload a maximum of ${MAX_FILES_PER_UPLOAD} files at a time.`);
      return;
    }

    const existingNames = new Set(
      existingFileNames.map((name) => name.trim().toLowerCase())
    );
    const duplicates = files.filter((file) =>
      existingNames.has(file.name.trim().toLowerCase())
    );

    if (duplicates.length > 0) {
      setMessage(
        `These files already exist: ${duplicates
          .map((file) => file.name)
          .join(", ")}`
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const uploadedDocuments: UploadedDocument[] = [];

      for (const file of files) {
        const uploadedBlob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob",
          multipart: true,
        });

        const res = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            blobUrl: uploadedBlob.url,
            pathname: uploadedBlob.pathname,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error || `Upload failed for ${file.name}`
          );
        }

        uploadedDocuments.push({
          id: data.document.id,
          name: data.document.originalName,
        });
      }

      setMessage(
        `Uploaded successfully: ${uploadedDocuments.length} document${
          uploadedDocuments.length > 1 ? "s" : ""
        }.`
      );

      setFiles([]);
      onUploadSuccess(uploadedDocuments);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-sm transition-shadow hover:shadow-md">
      <h2 className="mb-2 text-2xl font-bold text-slate-100">
        Upload contract PDFs
      </h2>
      <p className="mb-6 text-slate-300">
        Choose up to {MAX_FILES_PER_UPLOAD} PDF files to analyze and search across
      </p>

      <div className="mb-6 rounded-xl border-2 border-dashed border-slate-700 p-8 text-center transition-colors hover:border-slate-500">
        <svg
          className="mx-auto mb-2 h-8 w-8 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>

        <input
          type="file"
          accept="application/pdf"
          multiple
          onChange={(e) => {
            const selectedFiles = Array.from(e.target.files || []);
            const existingNames = new Set(
              existingFileNames.map((name) => name.trim().toLowerCase())
            );

            const uniqueSelectedFiles = selectedFiles.filter((file, index, all) => {
              const normalizedName = file.name.trim().toLowerCase();
              return (
                all.findIndex(
                  (candidate) => candidate.name.trim().toLowerCase() === normalizedName
                ) === index
              );
            });

            const allowedFiles = uniqueSelectedFiles.filter(
              (file) => !existingNames.has(file.name.trim().toLowerCase())
            );
            const blockedFiles = uniqueSelectedFiles.filter((file) =>
              existingNames.has(file.name.trim().toLowerCase())
            );

            const limitedFiles = allowedFiles.slice(0, MAX_FILES_PER_UPLOAD);
            const overflowCount = Math.max(0, allowedFiles.length - MAX_FILES_PER_UPLOAD);

            setFiles(limitedFiles);

            const messages: string[] = [];

            if (blockedFiles.length > 0) {
              messages.push(
                `Skipped existing file${
                  blockedFiles.length > 1 ? "s" : ""
                }: ${blockedFiles.map((file) => file.name).join(", ")}`
              );
            }

            if (overflowCount > 0) {
              messages.push(
                `Only the first ${MAX_FILES_PER_UPLOAD} new files were kept.`
              );
            }

            setMessage(messages.join(" "));
            e.currentTarget.value = "";
          }}
          className="hidden"
          id="file-input"
        />

        <label htmlFor="file-input" className="cursor-pointer">
          <span className="block text-sm font-medium text-slate-100">
            {files.length > 0
              ? `${files.length} file${files.length > 1 ? "s" : ""} selected`
              : "Click to select PDF files or drag and drop"}
          </span>

          <span className="block text-xs text-slate-400">
            {files.length > 0
              ? files.map((file) => file.name).join(", ")
              : "PDF files only"}
          </span>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mb-6 space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2"
            >
              <p className="truncate pr-3 text-sm text-slate-200">{file.name}</p>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={loading || files.length === 0}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all disabled:opacity-50 enabled:hover:bg-blue-700 enabled:active:scale-95"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            Uploading...
          </span>
        ) : (
          `Upload ${files.length > 1 ? "PDFs" : "PDF"}`
        )}
      </button>

      {message && (
        <div
          className={`mt-4 rounded-lg p-3 text-sm ${
            message.includes("Uploaded successfully")
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}