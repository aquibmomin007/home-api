const SG_LAT = 1.3521;
const SG_LON = 103.8198;

const WEATHER_LABELS = {
  0: 'Clear',
  1: 'Mainly Clear',
  2: 'Partly Cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Rime Fog',
  51: 'Light Drizzle',
  53: 'Drizzle',
  55: 'Heavy Drizzle',
  61: 'Light Rain',
  63: 'Rain',
  65: 'Heavy Rain',
  71: 'Light Snow',
  73: 'Snow',
  75: 'Heavy Snow',
  80: 'Rain Showers',
  81: 'Showers',
  82: 'Heavy Showers',
  95: 'Thunderstorm',
  96: 'Storm + Hail',
  99: 'Severe Storm',
};

const RAINY_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);
const SUNNY_CODES = new Set([0, 1]);

const conditionForHour = (weatherCode, windKmh, rainProb) => {
  if ((windKmh ?? 0) >= 24) return 'windy';
  if ((rainProb ?? 0) >= 50 || RAINY_CODES.has(weatherCode)) return 'rainy';
  if (SUNNY_CODES.has(weatherCode)) return 'sunny';
  return 'cloudy';
};

const iconForCondition = (condition) => {
  switch (condition) {
    case 'sunny':
      return 'sunny';
    case 'rainy':
      return 'rainy';
    case 'windy':
      return 'windy';
    default:
      return 'cloudy';
  }
};

const sgHourNow = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hourPart = parts.find((p) => p.type === 'hour')?.value;
  return Number(hourPart || 0);
};

const buildHourlyMapByDate = (hourly) => {
  const times = hourly?.time || [];
  const weatherCodes = hourly?.weather_code || hourly?.weathercode || [];
  const rainProb = hourly?.precipitation_probability || [];
  const windspeed = hourly?.windspeed_10m || [];

  const byDate = {};
  times.forEach((dateTime, idx) => {
    const [dateStr, timeStr] = String(dateTime).split('T');
    if (!dateStr || !timeStr) return;
    const hour = Number(timeStr.slice(0, 2));
    if (Number.isNaN(hour)) return;

    const code = weatherCodes[idx];
    const wind = windspeed[idx] ?? 0;
    const rain = rainProb[idx] ?? 0;
    const condition = conditionForHour(code, wind, rain);

    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push({
      hour,
      number: hour,
      icon: iconForCondition(condition),
      condition,
      weatherCode: code,
      rainChance: rain,
      windKmh: wind,
    });
  });

  Object.keys(byDate).forEach((key) => {
    byDate[key].sort((a, b) => a.hour - b.hour);
  });

  return byDate;
};

const toLocalDateKey = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = `${dateObj.getMonth() + 1}`.padStart(2, '0');
  const day = `${dateObj.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dayLabel = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
};

async function fetchOpenMeteoSgForecast() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${SG_LAT}&longitude=${SG_LON}&timezone=Asia%2FSingapore&forecast_days=7&daily=weather_code,weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&hourly=weather_code,weathercode,precipitation_probability,windspeed_10m`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Climate provider error: HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export default async function climateRoutes(fastify) {
  fastify.get('/climate/sg-7day', async (request, reply) => {
    try {
      const data = await fetchOpenMeteoSgForecast();
      const daily = data?.daily || {};
      const dates = daily.time || [];
      const maxTemps = daily.temperature_2m_max || [];
      const minTemps = daily.temperature_2m_min || [];
      const rainProb = daily.precipitation_probability_max || [];
      const windMax = daily.windspeed_10m_max || [];
      const weatherCodes = daily.weather_code || daily.weathercode || [];
      const todayKey = toLocalDateKey(new Date());
      const currentSgHour = sgHourNow();
      const hourlyByDate = buildHourlyMapByDate(data?.hourly || {});

      const days = dates.map((dateStr, idx) => {
        const code = weatherCodes[idx];
        const rawBlocks = hourlyByDate[dateStr] || [];
        const hourlyBlocks = dateStr === todayKey
          ? rawBlocks.filter((block) => block.hour >= currentSgHour)
          : rawBlocks;

        return {
          date: dateStr,
          dayLabel: dayLabel(dateStr),
          isToday: dateStr === todayKey,
          maxTemp: maxTemps[idx],
          minTemp: minTemps[idx],
          rainChance: rainProb[idx],
          windMax: windMax[idx],
          weatherCode: code,
          summary: WEATHER_LABELS[code] || 'Forecast',
          hourlyBlocks,
        };
      });

      return {
        success: true,
        source: 'Open-Meteo forecast (Singapore coordinates)',
        updatedAt: new Date().toISOString(),
        data: days,
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        reply.code(504);
        return {
          success: false,
          error: 'Climate provider request timed out',
        };
      }

      reply.code(502);
      return {
        success: false,
        error: error.message || 'Failed to fetch SG climate forecast',
      };
    }
  });
}