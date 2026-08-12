export default async function busRoutes(fastify) {
  const FETCH_TIMEOUT_MS = 10000;

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchWithLtaKey(url, accountKey) {
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        AccountKey: accountKey,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const err = new Error(`LTA API error: ${response.status}`);
      err.statusCode = response.status;
      err.responseBody = body;
      throw err;
    }

    return response.json();
  }

  fastify.get('/bus/arrivals/:busStopCode', async (request, reply) => {
    const { busStopCode } = request.params;
    const LTA_API_BASE = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival';
    const LTA_ACCOUNT_KEY = process.env.LTA_ACCOUNT_KEY;

    if (!LTA_ACCOUNT_KEY) {
      reply.code(503);
      return { error: 'LTA API key not configured on server' };
    }

    try {
      const url = `${LTA_API_BASE}?BusStopCode=${busStopCode}`;
      const data = await fetchWithLtaKey(url, LTA_ACCOUNT_KEY);
      return { success: true, data };
    } catch (error) {
      if (error?.name === 'AbortError') {
        reply.code(504);
        return {
          success: false,
          error: 'LTA API request timed out',
          upstreamStatus: 504,
        };
      }

      if (error?.statusCode === 401 || error?.statusCode === 403) {
        reply.code(401);
        return {
          success: false,
          error: 'Invalid or unauthorized LTA_ACCOUNT_KEY',
          upstreamStatus: error.statusCode,
        };
      }

      reply.code(502);
      return {
        success: false,
        error: error.message || 'Failed to fetch bus arrivals',
        upstreamStatus: error?.statusCode || 502,
      };
    }
  });
}
