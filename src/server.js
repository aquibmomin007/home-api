import Fastify from 'fastify';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import taskRoutes from './routes/tasks.js';
import healthRoutes from './routes/health.js';
import busRoutes from './routes/bus.js';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

export const prisma = new PrismaClient();

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
fastify.register(taskRoutes);
fastify.register(busRoutes);

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
