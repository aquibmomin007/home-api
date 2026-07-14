import { prisma } from '../server.js';

const CATEGORY_VALUES = ['veggies', 'meat', 'fish', 'sauce', 'cooked food'];

const toIsoDate = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = `${dateObj.getMonth() + 1}`.padStart(2, '0');
  const day = `${dateObj.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split('-').map((v) => Number(v));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseCategoryToDb = (value) => {
  if (!CATEGORY_VALUES.includes(value)) return null;
  return value === 'cooked food' ? 'cooked_food' : value;
};

const parseCategoryFromDb = (value) => (value === 'cooked_food' ? 'cooked food' : value);

const diffInDaysFromToday = (dateObj) => {
  if (!dateObj) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate());
  return Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
};

const getStatusAndAge = (grocery) => {
  if (grocery.finished) return { status: 'finished', ageDays: '' };
  const anchor = grocery.category === 'sauce' ? grocery.openedDate : grocery.dateAdded;
  if (!anchor) return { status: 'fresh', ageDays: '' };
  const days = diffInDaysFromToday(anchor);
  if (days === null || days < 0) return { status: 'fresh', ageDays: '0' };
  if (days <= 2) return { status: 'fresh', ageDays: String(days) };
  if (days <= 5) return { status: 'bit old', ageDays: String(days) };
  if (days <= 8) return { status: 'finish faster', ageDays: String(days) };
  return { status: 'throw away', ageDays: String(days) };
};

const serializeGrocery = (grocery) => {
  const derived = getStatusAndAge(grocery);
  return {
    id: grocery.id,
    name: grocery.name,
    category: parseCategoryFromDb(grocery.category),
    dateAdded: grocery.dateAdded ? toIsoDate(grocery.dateAdded) : '',
    openedDate: grocery.openedDate ? toIsoDate(grocery.openedDate) : '',
    finished: grocery.finished,
    status: derived.status,
    ageDays: derived.ageDays,
    createdAt: grocery.createdAt,
    updatedAt: grocery.updatedAt,
  };
};

export default async function groceryRoutes(fastify) {
  fastify.get('/groceries', async (request, reply) => {
    try {
      const groceries = await prisma.grocery.findMany({
        orderBy: [{ createdAt: 'desc' }],
      });
      return { success: true, data: groceries.map(serializeGrocery) };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  fastify.post('/groceries', async (request, reply) => {
    try {
      const { name, category, dateAdded, openedDate, finished } = request.body || {};
      const trimmedName = typeof name === 'string' ? name.trim() : '';
      if (!trimmedName) {
        reply.code(400);
        return { success: false, error: 'Name is required' };
      }

      const dbCategory = parseCategoryToDb(category);
      if (!dbCategory) {
        reply.code(400);
        return { success: false, error: 'Invalid category' };
      }

      const parsedDateAdded = dateAdded ? parseDateInput(dateAdded) : new Date();
      if (!parsedDateAdded) {
        reply.code(400);
        return { success: false, error: 'Invalid dateAdded format. Use YYYY-MM-DD' };
      }

      const parsedOpenedDate = openedDate ? parseDateInput(openedDate) : null;
      if (openedDate && !parsedOpenedDate) {
        reply.code(400);
        return { success: false, error: 'Invalid openedDate format. Use YYYY-MM-DD' };
      }

      const grocery = await prisma.grocery.create({
        data: {
          name: trimmedName,
          category: dbCategory,
          dateAdded: parsedDateAdded,
          openedDate: dbCategory === 'sauce' ? parsedOpenedDate : null,
          finished: Boolean(finished),
          finishedAt: finished ? new Date() : null,
        },
      });

      reply.code(201);
      return { success: true, data: serializeGrocery(grocery) };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  fastify.patch('/groceries/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const { name, category, dateAdded, openedDate, finished } = request.body || {};

      const updateData = {};

      if (name !== undefined) {
        const trimmedName = typeof name === 'string' ? name.trim() : '';
        if (!trimmedName) {
          reply.code(400);
          return { success: false, error: 'Name cannot be empty' };
        }
        updateData.name = trimmedName;
      }

      if (category !== undefined) {
        const dbCategory = parseCategoryToDb(category);
        if (!dbCategory) {
          reply.code(400);
          return { success: false, error: 'Invalid category' };
        }
        updateData.category = dbCategory;
        if (dbCategory !== 'sauce') {
          updateData.openedDate = null;
        }
      }

      if (dateAdded !== undefined) {
        const parsed = parseDateInput(dateAdded);
        if (!parsed) {
          reply.code(400);
          return { success: false, error: 'Invalid dateAdded format. Use YYYY-MM-DD' };
        }
        updateData.dateAdded = parsed;
      }

      if (openedDate !== undefined) {
        if (openedDate === '' || openedDate === null) {
          updateData.openedDate = null;
        } else {
          const parsed = parseDateInput(openedDate);
          if (!parsed) {
            reply.code(400);
            return { success: false, error: 'Invalid openedDate format. Use YYYY-MM-DD' };
          }
          updateData.openedDate = parsed;
        }
      }

      if (finished !== undefined) {
        updateData.finished = Boolean(finished);
        updateData.finishedAt = finished ? new Date() : null;
      }

      const grocery = await prisma.grocery.update({
        where: { id },
        data: updateData,
      });

      return { success: true, data: serializeGrocery(grocery) };
    } catch (error) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { success: false, error: 'Grocery item not found' };
      }
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  fastify.post('/groceries/:id/finish', async (request, reply) => {
    try {
      const { id } = request.params;
      const grocery = await prisma.grocery.update({
        where: { id },
        data: {
          finished: true,
          finishedAt: new Date(),
        },
      });
      return { success: true, data: serializeGrocery(grocery) };
    } catch (error) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { success: false, error: 'Grocery item not found' };
      }
      reply.code(500);
      return { success: false, error: error.message };
    }
  });

  fastify.delete('/groceries/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      await prisma.grocery.delete({ where: { id } });
      reply.code(204);
      return null;
    } catch (error) {
      if (error.code === 'P2025') {
        reply.code(404);
        return { success: false, error: 'Grocery item not found' };
      }
      reply.code(500);
      return { success: false, error: error.message };
    }
  });
}