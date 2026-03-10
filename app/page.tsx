"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import AskBox from "@/components/AskBox";

export default function HomePage() {
  const [documentId, setDocumentId] = useState<string | null>(null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">

      {!documentId && (
        <UploadForm
          onUploadSuccess={(id) => {
            setDocumentId(id);
          }}
        />
      )}

      {documentId && (
        <AskBox documentId={documentId} />
      )}

    </main>
  );
}