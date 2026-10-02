# Finance Audit Engine

Finance Audit Engine is an asynchronous NestJS service for ingesting invoice documents, extracting structured invoice data with Gemini, and applying deterministic financial audit rules. PostgreSQL stores workflow data, Redis and BullMQ coordinate background jobs, and an outbox publisher keeps document creation separate from queue delivery.

## Live Demo

The application is deployed and available for testing at:

**[View Live  Application](https://audit.chaomelo.online/).**

The demo uses the same asynchronous processing flow described below, including document upload, background processing, structured extraction, and audit result retrieval.

## What It Does

1. Accepts an invoice upload and stores it on the local filesystem.
2. Creates the document and an outbox event in one PostgreSQL transaction.
3. Publishes a BullMQ job through Redis.
4. Extracts text from the PDF and structures invoice data with Gemini.
5. Persists the invoice and line items.
6. Checks totals, required identifiers, and duplicate invoices.
7. Exposes the complete processing result through the document API.

## Quick Start

```bash
cp .env.example .env
docker compose up --build -d
```

Replace the database password and API-key placeholders in `.env` before starting the application. See [Getting Started](docs/getting-started.md) for the variable reference and complete walkthrough.

Upload a text-based PDF:

```bash
curl -X POST http://localhost:3000/documents \
  -F "file=@/absolute/path/to/invoice.pdf"
```

Then poll the returned ID:

```bash
curl http://localhost:3000/documents/DOCUMENT_ID
```

## Documentation

- [Documentation index](docs/index.md)
- [Getting started](docs/getting-started.md)
- [Container deployment](docs/container-deployment.md)
- [Architecture and processing flow](docs/architecture.md)
- [HTTP API](docs/api.md)
- [Data model and audit rules](docs/data-model.md)
- [Operations and development](docs/operations.md)

## Technology

- NestJS 11 and TypeScript
- Prisma ORM 7 with PostgreSQL
- BullMQ with Redis
- Google Gemini structured output
- Zod response validation
- `pdf-parse` for PDF text extraction
- Multer and local filesystem storage

## Project Structure

```text
prisma/                 Prisma schema and migrations
src/common/             Shared processing errors
src/infrastructure/     Database, queue, storage, and AI adapters
src/modules/            Documents, outbox, extraction, invoices, and audit
docs/                   Project documentation
storage/documents/      Local uploaded files created at runtime
```

## Commands

| Command             | Description             |
| ------------------- | ----------------------- |
| `npm run start:dev` | Run in watch mode       |
| `npm run build`     | Compile the application |
| `npm run lint`      | Run ESLint with fixes   |
| `npm test`          | Run unit tests          |
| `npm run test:e2e`  | Run end-to-end tests    |
| `npm run test:cov`  | Generate test coverage  |

## Current Scope

The API accepts PDF, JPEG, and PNG uploads, but the worker currently implements PDF text extraction only. OCR, authentication, shared object storage, and production health endpoints are documented as extension points in [Operations and Development](docs/operations.md).

## License

This project is private and marked `UNLICENSED`.
