import Fastify from 'fastify';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import taskRoutes from './routes/tasks.js';
import healthRoutes from './routes/health.js';
import busRoutes from './routes/bus.js';
import groceryRoutes from './routes/groceries.js';
import climateRoutes from './routes/climate.js';
import flightRoutes from './routes/flights.js';
import { isApiAppEnabled } from './appSwitches.js';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

const prismaAdapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma = new PrismaClient({
  adapter: prismaAdapter,
});

// Add CORS headers manually
fastify.addHook('onSend', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

// Handle preflight requests
fastify.options('/*', async (request, reply) => {
  reply
    .header('Access-Control-Allow-Origin', '*')
    .header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    .send();
});

// Register routes
fastify.register(healthRoutes);
if (isApiAppEnabled('checklist')) {
  fastify.register(taskRoutes);
}

if (isApiAppEnabled('bus')) {
  fastify.register(busRoutes);
}

if (isApiAppEnabled('grocery')) {
  fastify.register(groceryRoutes);
}

if (isApiAppEnabled('climate')) {
  fastify.register(climateRoutes);
}

if (isApiAppEnabled('flights')) {
  fastify.register(flightRoutes);
}

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`✅ Server running at http://localhost:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  await fastify.close();
  process.exit(0);
});

start();
