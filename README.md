# DOCQUERY AI

DOCQUERY AI is a legal document Q&A app that lets you upload contract PDFs and ask grounded questions with page-level citations.

It supports two retrieval scopes:

- `document`: search the currently selected file
- `workspace`: search across all uploaded files for comparison questions

## Why I Built This

I built this after a purchase deal left me with a stack of contract documents and a lot of legal questions before speaking with my lawyer.

I wanted a faster way to find the exact clauses I cared about, like payment deadlines, renewal terms, cancellation windows, and liability language, without manually scanning every page first.

This project became my way to prototype a practical pre-review assistant: something that helps me ask better, more specific questions when I do meet with legal counsel.

## Features

- Multi-file PDF upload (up to 5 files per upload action)
- Duplicate file-name checks in UI and API flow
- Progressive indexing with document status polling
- Query rewrite for follow-up questions
- Hybrid retrieval + reranking before generation
- Streaming answers over Server-Sent Events (SSE)
- Source evidence with document name, chunk index, and page number
- Demo guardrails (per-IP rate limits, max docs, max input sizes)

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Prisma + PostgreSQL
- `pgvector` for embeddings
- OpenAI Responses API
- Vercel Blob for uploads

## How It Works

1. User uploads a PDF through Vercel Blob.
2. API extracts PDF text and stores a `Document` record.
3. Text is chunked and indexed progressively.
4. Ask flow rewrites the question, retrieves chunks, reranks them, then builds context.
5. Answer is streamed token-by-token with separate `sources` and `meta` events.

## Project Structure

```text
app/
	api/
		ask/route.ts          # Question endpoint (SSE streaming)
		blob/route.ts         # Vercel Blob upload token endpoint
		document/[id]/route.ts# Document indexing status endpoint
		upload/route.ts       # Parse + ingest uploaded PDF
components/
	AskBox.tsx              # Chat UI and streamed answer handling
	UploadForm.tsx          # Multi-file uploader
lib/
	ingest.ts               # Chunking + indexing orchestration
	retrieve.ts             # Document-scope retrieval
	retrieveWorkspace.ts    # Workspace-scope retrieval
	rerankChunks.ts         # LLM reranking step
	rewriteQuery.ts         # Follow-up question rewriting
	buildContext.ts         # Context assembly and truncation
prisma/
	schema.prisma           # Data model
	migrations/             # DB migrations (including pgvector setup)
```

## Prerequisites

- Node.js 20+
- PostgreSQL database
- `pgvector` enabled in your DB
- OpenAI API key
- Vercel Blob token

## Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
BLOB_READ_WRITE_TOKEN="..."

# Optional demo guardrails (defaults shown)
DEMO_UPLOADS_PER_WINDOW="5"
DEMO_UPLOAD_WINDOW_MS="600000"
DEMO_ASKS_PER_WINDOW="40"
DEMO_ASK_WINDOW_MS="600000"
DEMO_MAX_DOCUMENTS="100"
DEMO_MAX_EXTRACTED_CHARS="300000"
DEMO_MAX_QUESTION_LENGTH="600"
```

## Local Development

Install dependencies:

```bash
npm install
```

Apply migrations:

```bash
npx prisma migrate deploy
```

Run development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## API Overview

### `POST /api/blob`

Returns a Vercel Blob upload token and enforces PDF-only uploads up to 10MB.

### `POST /api/upload`

Body:

```json
{
	"blobUrl": "https://...",
	"pathname": "...",
	"fileName": "contract.pdf",
	"mimeType": "application/pdf",
	"size": 12345
}
```

Behavior:

- Validates file type/size
- Extracts PDF text
- Creates `Document`
- Indexes chunks progressively
- Returns indexing status and counts

### `GET /api/document/:id`

Returns document metadata and indexing progress:

```json
{
	"document": {
		"id": "...",
		"originalName": "contract.pdf",
		"status": "PARTIALLY_INDEXED"
	},
	"chunkCount": 120,
	"indexedChunkCount": 45
}
```

### `POST /api/ask`

Body:

```json
{
	"documentId": "...",
	"question": "What are termination notice requirements?",
	"chatHistory": [{ "role": "user", "content": "..." }],
	"scope": "document"
}
```

Returns SSE stream with events:

- `sources`
- `meta` (includes rewritten query)
- `token`
- `done`
- `error`

## Document Status Values

- `PROCESSING`
- `PARTIALLY_INDEXED`
- `PROCESSED`
- `FAILED`

## NPM Scripts

- `npm run dev` - start local dev server
- `npm run build` - generate Prisma client and build app
- `npm run start` - run production server
- `npm run lint` - run ESLint

## Notes

- In-memory rate limiting is intended for demo/single-instance usage.
- The `app/api/evaluations/` directory is currently present but empty.

## Suggested Next Improvements

- Persist chat sessions and document collections per user
- Add citation jump-to-page PDF preview
- Add automated RAG evaluation routes and dashboards

