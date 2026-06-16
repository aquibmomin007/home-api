import Fastify from 'fastify';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import taskRoutes from './routes/tasks.js';
import healthRoutes from './routes/health.js';

dotenv.config();

const fastify = Fastify({
  logger: true,
});

export const prisma = new PrismaClient();

// Register routes
fastify.register(healthRoutes);
fastify.register(taskRoutes);

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
