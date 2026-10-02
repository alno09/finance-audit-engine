# Container Deployment

The repository includes a multi-stage `Dockerfile` and a complete Compose stack for the Nest API, PostgreSQL, Redis, migrations, and persistent document storage.

## Services

| Service    | Purpose                                           |
| ---------- | ------------------------------------------------- |
| `postgres` | PostgreSQL 16 database with a persistent volume   |
| `redis`    | BullMQ backend with a persistent volume           |
| `migrate`  | One-shot `prisma migrate deploy` task             |
| `app`      | Non-root production NestJS API and worker process |

Compose starts `app` only after PostgreSQL and Redis are healthy and the migration task succeeds.

## Server setup

Clone the repository and create the environment file:

```bash
cp .env.example .env
```

Before starting the stack, edit `.env`:

1. Replace `POSTGRES_PASSWORD` with a strong password.
2. Put the same database credentials in `CONTAINER_DATABASE_URL`, using `postgres` as the hostname.
3. Set `GEMINI_API_KEY`.
4. Set `CORS_ORIGIN` to the deployed frontend origin. Multiple origins can be comma-separated.
5. Change `APP_PORT` if the API should use a host port other than `3000`.

Example database values:

```dotenv
POSTGRES_DB=finance_audit
POSTGRES_USER=finance
POSTGRES_PASSWORD="use-a-strong-password"
CONTAINER_DATABASE_URL="postgresql://finance:use-a-strong-password@postgres:5432/finance_audit"
```

If the password contains URL-reserved characters, percent-encode those characters only in `CONTAINER_DATABASE_URL` while keeping the raw password in `POSTGRES_PASSWORD`.

## Build and start

```bash
docker compose up --build -d
```

Check service state and logs:

```bash
docker compose ps
docker compose logs -f app
```

The API is available at `http://SERVER_IP:APP_PORT`. PostgreSQL and Redis are bound to server loopback rather than public interfaces.

## Update the deployment

```bash
git pull
docker compose up --build -d
```

The new migration image applies pending committed migrations before the replacement app starts.

## Stop or remove

Stop containers while preserving all data:

```bash
docker compose down
```

Do not add `--volumes` unless you intentionally want to delete PostgreSQL data, Redis data, and uploaded documents.

## Persistent data

Compose uses these named volumes:

- `postgres_data`
- `redis_data`
- `document_storage`

Back up both PostgreSQL and `document_storage`. Database records reference uploaded files by storage key, so restoring only one side produces incomplete documents.

## Image structure

The `build` stage installs all dependencies, generates Prisma Client, and compiles Nest. The final `production` stage contains only production dependencies and compiled output, creates the document directory, and runs as the unprivileged Node user.

The migration target retains Prisma CLI as a build dependency and runs separately from the app container.

## Reverse proxy and TLS

For an internet-facing server, place Caddy, Nginx, Traefik, or a cloud load balancer in front of `APP_PORT`. Terminate TLS there and expose only ports 80/443 publicly. Keep PostgreSQL and Redis private.

Set `TRUSTED_PROXIES` to the actual proxy IPs or CIDRs so the upload quota sees
the visitor IP. Leave it blank for direct access. Only trust proxies you control
that overwrite forwarded headers; overly broad ranges allow forged client IPs.
Check this configuration against your hosting provider before deploying.

Upload quotas are shared in Redis and reset at midnight UTC. Compose enables
Redis AOF persistence to retain counters across restarts; deleting Redis data
resets quotas as well as queue data.
