# ADocQuery: Multi-Document Contract RAG Assistant

ADocQuery is a portfolio-ready legal-tech demo that lets users upload contract PDFs and ask grounded questions with citations.

It supports both:
- `document` mode: retrieval from one selected contract
- `workspace` mode: retrieval across all uploaded contracts for comparisons

## Why This Project Is Strong For A Portfolio

- Demonstrates practical Retrieval-Augmented Generation (RAG), not just chat UI.
- Uses query rewriting + reranking to improve retrieval quality.
- Streams answers in real-time and returns source chunks with page metadata.
- Includes explainability signals, including the rewritten retrieval query.
- Shows product decisions in UX: scope selection, duplicate upload protection, and upload constraints.

## Core Features

- Multi-PDF upload with duplicate filename blocking
- Maximum 5 files per upload attempt
- Remove selected files before upload
- Scope-aware retrieval (current document vs all documents)
- Query rewrite for conversational follow-ups
- LLM reranking of retrieved chunks
- Source citations with document name, page, and chunk index
- Streaming answer tokens via Server-Sent Events (SSE)
- Public-demo abuse safeguards (rate limits, upload caps, and server-side validation)

## Public Demo Safeguards

Because this demo uses a shared database, the API now includes guardrails:

- Per-IP upload rate limiting
- Per-IP question rate limiting
- Global maximum number of documents in the database
- Server-side duplicate filename blocking
- Maximum extracted PDF text length to control embedding spend
- Maximum question length to reduce prompt abuse

These checks are enforced on the backend and do not depend on client behavior.

## Tech Stack

- Next.js App Router
- TypeScript
- Prisma
- Postgres + pgvector
- Vercel Blob
- OpenAI Responses API

## RAG Flow

1. User asks a question.
2. `rewriteQuery` converts follow-up phrasing into a standalone retrieval query.
3. System retrieves top chunks from selected scope (`document` or `workspace`).
4. `rerankChunks` reorders chunks using an LLM relevance pass.
5. `buildContext` assembles bounded context with document/page labels.
6. Assistant streams a grounded answer and emits source metadata.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` with required values:

```bash
DATABASE_URL="..."
OPENAI_API_KEY="..."
BLOB_READ_WRITE_TOKEN="..."

# Optional demo guardrails
DEMO_UPLOADS_PER_WINDOW="5"
DEMO_UPLOAD_WINDOW_MS="600000"
DEMO_ASKS_PER_WINDOW="40"
DEMO_ASK_WINDOW_MS="600000"
DEMO_MAX_DOCUMENTS="100"
DEMO_MAX_EXTRACTED_CHARS="300000"
DEMO_MAX_QUESTION_LENGTH="600"
```

3. Run migrations:

```bash
npx prisma migrate deploy
```

4. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Recommended Demo Script (2-3 minutes)

1. Upload 2-3 contract PDFs.
2. Ask in `document` scope: `Summarize termination and notice requirements.`
3. Switch to `workspace` scope and ask: `Which document mentions payment within 15 days?`
4. Ask a comparison question: `Compare renewal clauses across all uploaded documents.`
5. Highlight:
	- rewritten retrieval query
	- source cards with document/page citations
	- streamed response behavior

## High-Impact Future Enhancements

- Side-by-side diff view for clause comparisons
- Source highlighting in PDF preview
- Evaluation harness for retrieval/answer quality
- Role-based auth and workspace persistence

