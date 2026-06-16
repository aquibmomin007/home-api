import { prisma } from '../server.js';

export default async function taskRoutes(fastify) {
  // Get all tasks
  fastify.get('/tasks', async (request, reply) => {
    try {
      const tasks = await prisma.task.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });
      return { success: true, data: tasks };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Get task by ID
  fastify.get('/tasks/:id', async (request, reply) => {
    try {
      const task = await prisma.task.findUnique({
        where: { id: request.params.id },
      });
      if (!task) {
        reply.code(404);
        return { success: false, error: 'Task not found' };
      }
      return { success: true, data: task };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Create task
  fastify.post('/tasks', async (request, reply) => {
    try {
      const { title } = request.body;
      if (!title || typeof title !== 'string' || title.trim() === '') {
        reply.code(400);
        return { success: false, error: 'Title is required and must be a non-empty string' };
      }

      const task = await prisma.task.create({
        data: {
          title: title.trim(),
        },
      });
      reply.code(201);
      return { success: true, data: task };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Update task
  fastify.patch('/tasks/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { title, completed } = request.body;

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (completed !== undefined) updateData.completed = completed;

      const task = await prisma.task.update({
        where: { id },
        data: updateData,
      });
      return { success: true, data: task };
    } catch (error) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { success: false, error: 'Task not found' };
      }
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  // Delete task
  fastify.delete('/tasks/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await prisma.task.delete({
        where: { id },
      });
      reply.code(204);
      return null;
    } catch (error) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { success: false, error: 'Task not found' };
      }
      reply.code(500);
      return { success: false, error: error.message };
    }
  });
}
