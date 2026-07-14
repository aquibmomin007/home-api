# Home API deployment plan

This repo is prepared for a GitHub-driven deployment flow:

- CI validates Prisma and Docker builds on push and pull request.
- Packaging publishes a multi-arch image to GitHub Container Registry.
- Deploy is manual and only runs when the workflow input `deploy` is set to `true`.
- Production database changes are applied with `prisma migrate deploy` before the new API container is started.

## What is already wired in this repo

- Docker image build via `Dockerfile`
- Production compose template via `deploy/docker-compose.production.yml`
- CI workflow via `.github/workflows/home-api-ci.yml`
- Package workflow via `.github/workflows/home-api-package.yml`
- Manual deploy workflow via `.github/workflows/home-api-deploy.yml`
- Production env example via `.env.production.example`

## Database strategy

Use one database in development and a separate database in production.

- Development: local Docker Postgres on your Mac, referenced by local `.env`
- Production primary: Postgres on the Raspberry Pi or another host
- Production replica: a second machine, not the same Pi, streaming from the primary

The application always points to the correct database through `DATABASE_URL`.

## Migration strategy

- Local development: `npx prisma migrate dev`
- Production deploy: `npx prisma migrate deploy`

Do not use `prisma migrate dev` in production.

## GitHub settings you still need

Create these repository secrets before using the deploy workflow:

- `PI_HOST`
- `PI_USER`
- `PI_SSH_KEY`
- `PI_SSH_PORT` if you do not use port 22

Create a GitHub environment named `production` if you want approval gates before deploy.

## Production deploy flow

1. Push code to GitHub.
2. Let the CI workflow validate Prisma and Docker build.
3. Let the package workflow publish the image to `ghcr.io`.
4. Run the `Home API Deploy` workflow manually.
5. Set `deploy=true`.
6. Choose the image tag to deploy, usually `latest` or a specific SHA tag.
7. The workflow copies the production compose file to the server, pulls the image, runs `prisma migrate deploy`, restarts the API container, and checks `/health`.

## Raspberry Pi files expected later

When the Pi is ready, create `/opt/home-api/.env` with production values based on `.env.production.example`.

The deploy workflow expects `/opt/home-api/.env` to already exist on the Pi.

## Replica note

The deploy workflow only targets the API service. Database replication should be managed separately at the Postgres layer. The production `DATABASE_URL` must always point to the primary database endpoint for writes.
