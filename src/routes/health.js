import { prisma } from '../server.js';

export default async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(503);
      return {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      };
    }
  });
}
