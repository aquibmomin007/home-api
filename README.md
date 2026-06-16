# Home API

Backend API for the Home App checklist. Built with Fastify, PostgreSQL, and Prisma.

## Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Containerization**: Docker Compose

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for running PostgreSQL locally)
- Git

## Setup

### 1. Clone and Install Dependencies

```bash
cd home-api
npm install
```

### 2. Set Up Environment

Copy the example env file:
```bash
cp .env.example .env
```

Update `.env` with your database credentials. Default values for local dev:
```
DATABASE_URL="postgresql://homeuser:homepass@localhost:5432/home_db"
PORT=3000
NODE_ENV=development
```

### 3. Start PostgreSQL with Docker Compose

```bash
docker compose up -d
```

This starts a PostgreSQL container with the default credentials. The database will be available at `localhost:5432`.

### 4. Set Up Prisma

Generate the Prisma client and run migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

This will create the database schema (tables for tasks and devices).

### 5. Start the API Server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

Check health:
```bash
curl http://localhost:3000/health
```

## API Endpoints

### Health Check
- `GET /health` - Check if the server and database are running

### Tasks

- `GET /tasks` - Get all tasks
- `GET /tasks/:id` - Get a specific task
- `POST /tasks` - Create a new task
  - Body: `{ "title": "Task title" }`
- `PATCH /tasks/:id` - Update a task
  - Body: `{ "title": "New title", "completed": true }`
- `DELETE /tasks/:id` - Delete a task

## Development

### Watch Mode

Auto-reload on file changes:
```bash
npm run dev
```

### Prisma Studio

Open an interactive database UI:
```bash
npm run prisma:studio
```

## Deployment to Raspberry Pi

1. Install Node.js 18+ and Docker on your Raspberry Pi
2. Clone this repo onto the Pi:
   ```bash
   git clone <repo-url> home-api
   cd home-api
   ```
3. Copy your `.env` file (update the DATABASE_URL if needed)
4. Start with Docker Compose:
   ```bash
   docker compose up -d
   ```
5. Run migrations:
   ```bash
   npm run prisma:migrate
   ```
6. Start the server:
   ```bash
   npm start
   ```

For production on Pi, consider using PM2 or systemd to keep the service running.

## Testing

Example API calls:

```bash
# Get all tasks
curl http://localhost:3000/tasks

# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"My first task"}'

# Toggle task completion
curl -X PATCH http://localhost:3000/tasks/<ID> \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Delete a task
curl -X DELETE http://localhost:3000/tasks/<ID>
```

## Notes

- The database persists in a Docker volume at `postgres_data/`
- To reset the database, delete the volume: `docker compose down -v`
- All timestamps are UTC
- Task IDs are CUID format
