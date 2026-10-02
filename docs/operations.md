# Operations and Development

## Runtime dependencies

| Dependency       | Local default       | Purpose                             |
| ---------------- | ------------------- | ----------------------------------- |
| PostgreSQL 16    | `localhost:5432`    | Durable application and outbox data |
| Redis 7          | `localhost:6379`    | BullMQ jobs and retry state         |
| Local filesystem | `storage/documents` | Uploaded source documents           |
| Google Gemini    | External API        | Structured invoice extraction       |

## Environment variables

| Variable         | Required           | Default     | Description                                                        |
| ---------------- | ------------------ | ----------- | ------------------------------------------------------------------ |
| `DATABASE_URL`   | Yes                | None        | PostgreSQL connection URL used by Prisma CLI and runtime           |
| `GEMINI_API_KEY` | Yes for processing | None        | API key used by the active invoice AI provider                     |
| `REDIS_HOST`     | No                 | `localhost` | Redis host for BullMQ                                              |
| `REDIS_PORT`     | No                 | `6379`      | Redis port for BullMQ                                              |
| `PORT`           | No                 | `3000`      | HTTP listen port                                                   |
| `OPENAI_API_KEY` | No                 | None        | Used only if `AiModule` is changed to the included OpenAI provider |

Do not commit `.env`; it is excluded by `.gitignore`.

## Local storage

`LocalStorageService` creates `storage/documents` on first upload and stores each file under a random UUID while retaining the original extension. The generated filename is saved as `Document.storageKey`.

This adapter assumes the API and worker share the same working directory and filesystem. A multi-host deployment should replace it with shared object storage through the existing `StorageService` abstraction.

## Database changes

Edit `prisma/schema.prisma`, then create and apply a development migration:

```bash
npx prisma migrate dev --name describe_your_change
```

For deployment environments, apply committed migrations without creating new ones:

```bash
npx prisma migrate deploy
```

Regenerate the client whenever the schema changes:

```bash
npx prisma generate
```

The application imports Prisma Client from `src/generated/prisma/client`.

## Queue inspection and retries

The queue name is `document-processing`. Jobs are retained on both completion and failure (`removeOnComplete: false`, `removeOnFail: false`), which is useful while developing but requires a retention policy in a long-running production environment.

Application-level behavior:

- Outbox publisher interval: 3 seconds
- Outbox batch size: 10 events
- Worker attempts: 5
- Worker backoff: exponential from 1 second
- Completed document states are idempotently skipped
- Permanent Gemini failures are converted to BullMQ `UnrecoverableError`

## Logging

Nest logs worker progress and audit summaries, including:

- Processing attempt number
- Loaded byte count and extracted character count
- Retry and permanent-failure messages
- Audit status and each finding

Error details are also exposed through `Document.errorMessage`. Avoid including sensitive document contents in thrown error messages or new logs.

## Health checks

There is no dedicated health endpoint yet. Useful manual checks are:

```bash
docker compose ps
npx prisma validate
npm run build
```

The root `GET /` endpoint is the Nest starter response and should not be treated as a complete dependency health check.

## Testing

```bash
npm test
npm run test:e2e
npm run test:cov
```

Most current unit test files are generated smoke-test scaffolds and do not yet provide their dependencies as mocks. Treat a passing build and focused integration checks as necessary validation until the test fixtures are completed.

## Extension points

### Replace local storage

Implement `StorageService` and change the provider binding in `StorageModule`.

### Replace the AI provider

Implement `InvoiceAiProvider` and change the provider binding in `AiModule`. Keep Zod validation at the provider boundary so downstream invoice persistence receives the same contract.

### Add OCR

Add an OCR extraction service, choose it based on MIME type, and store `Extraction.method` as `OCR`. The upload API already accepts JPEG and PNG, but this processing path is not implemented yet.

### Split API and worker processes

The BullMQ queue is already the boundary between upload publication and processing. A dedicated worker deployment can host `DocumentProcessor` as long as it has access to PostgreSQL, Redis, Gemini, and shared document storage.

## Production considerations

- Replace local filesystem storage with shared durable storage.
- Add authentication, authorization, request tracing, and rate limiting.
- Define BullMQ job-retention and dead-letter policies.
- Add an outbox lease/locking strategy before running multiple publisher instances.
- Add a publication-attempt limit and use the existing `OutboxStatus.FAILED` value.
- Restrict CORS through environment-specific configuration.
- Add readiness/liveness checks for PostgreSQL, Redis, storage, and worker availability.
