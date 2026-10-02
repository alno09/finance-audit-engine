# Getting Started

## Prerequisites

- Node.js 20.19 or newer
- npm
- Docker with Docker Compose
- A Google Gemini API key

## 1. Install dependencies

```bash
npm install
```

## 2. Start PostgreSQL and Redis

The repository includes local PostgreSQL 16 and Redis 7 services:

```bash
docker compose up -d postgres redis
```

PostgreSQL is exposed on port `5432` and Redis on `6379`. Their data is kept in named Docker volumes.

## 3. Configure the environment

Copy the committed example file:

```bash
cp .env.example .env
```

Then replace the database password and API-key placeholders in `.env`. The example contains:

```dotenv
DATABASE_URL="postgresql://finance:change-me-before-deploying@localhost:5432/finance_audit"
REDIS_HOST="localhost"
REDIS_PORT="6379"
GEMINI_API_KEY="your-gemini-api-key"
PORT="3000"
```

`PORT`, `REDIS_HOST`, and `REDIS_PORT` are optional and use the values shown above by default. `DATABASE_URL` and `GEMINI_API_KEY` are required for the complete processing flow.

The repository also contains an OpenAI provider implementation, but it is not registered by `AiModule`. `OPENAI_API_KEY` is therefore not required for the current Gemini-backed configuration.

## 4. Prepare the database

Apply the committed migrations and generate Prisma Client:

```bash
npx prisma migrate deploy
npx prisma generate
```

Prisma automatically discovers `prisma7.config.ts` in this repository. Generated client code is written to `src/generated/prisma`.

For local schema development, create a migration with:

```bash
npx prisma migrate dev --name describe_your_change
```

## 5. Start the application

```bash
npm run start:dev
```

The API listens on `http://localhost:3000` by default. CORS allows `http://localhost:3001` by default and can be configured with `CORS_ORIGIN`.

## 6. Upload an invoice

```bash
curl -X POST http://localhost:3000/documents \
  -F "file=@/absolute/path/to/invoice.pdf"
```

The upload endpoint returns immediately after storing the file and creating the database/outbox records. Processing continues asynchronously.

Use the returned document ID to poll for the completed result:

```bash
curl http://localhost:3000/documents/DOCUMENT_ID
```

Terminal document states are normally `APPROVED`, `NEEDS_REVIEW`, or `EXTRACTION_FAILED`.

## Useful commands

| Command             | Purpose                         |
| ------------------- | ------------------------------- |
| `npm run start:dev` | Start Nest in watch mode        |
| `npm run build`     | Compile the application         |
| `npm run lint`      | Run ESLint with automatic fixes |
| `npm test`          | Run unit tests                  |
| `npm run test:e2e`  | Run end-to-end tests            |
| `npm run test:cov`  | Run tests with coverage         |
| `npx prisma studio` | Inspect database records        |

Next: [Architecture and processing flow](architecture.md)
