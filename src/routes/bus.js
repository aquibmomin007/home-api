export default async function busRoutes(fastify) {
  async function fetchWithLtaKey(url, accountKey) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        AccountKey: accountKey,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`LTA API error: ${response.status}`);
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
      reply.code(502);
      return {
        success: false,
        error: error.message || 'Failed to fetch bus arrivals',
      };
    }
  });
}
