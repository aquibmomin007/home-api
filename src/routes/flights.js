import { prisma } from '../server.js';

const FLIGHTS_CONFIG = {
  homeAirport: 'SIN',
  timezone: 'Asia/Singapore',
  currency: 'SGD',
  shortTripMaxPrice: 400,
  longTripMaxPrice: 1000,
  shortTripDirectOnly: true,
  longTripAllowOneStop: true,
  cabinClasses: ['economy', 'economy premium'],
  preferredAirlines: ['Singapore Airlines', 'Scoot', 'Korean Air', 'Vietnam Airlines', 'ANA', 'JAL'],
  alert: {
    minDropSgd: 20,
    cooldownHours: 18,
  },
  shortDestinations: ['KUL', 'HKT', 'BKK', 'DPS', 'IPH', 'DAD', 'HAN', 'SGN'],
  longDestinations: ['TYO', 'OSA', 'FUK', 'SEL'],
};

const SG_PUBLIC_HOLIDAYS = new Set([
  '2026-01-01',
  '2026-02-17',
  '2026-02-18',
  '2026-03-20',
  '2026-04-03',
  '2026-05-01',
  '2026-05-31',
  '2026-06-01',
  '2026-11-14',
  '2026-12-25',
  '2027-01-01',
  '2027-02-06',
  '2027-02-07',
  '2027-03-09',
  '2027-03-26',
  '2027-05-01',
  '2027-05-20',
  '2027-07-10',
  '2027-11-04',
  '2027-12-25',
]);

const DAY_MS = 24 * 60 * 60 * 1000;

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const toUtcStartOfDate = (isoDate) => new Date(`${isoDate}T00:00:00.000Z`);

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

const hash = (value) => {
  let h = 0;
  for (let idx = 0; idx < value.length; idx += 1) {
    h = (h << 5) - h + value.charCodeAt(idx);
    h |= 0;
  }
  return Math.abs(h);
};

const seeded = (value) => {
  const x = Math.sin(hash(value)) * 10000;
  return x - Math.floor(x);
};

function nextWeekdayOnOrAfter(startDate, weekday) {
  const date = new Date(startDate);
  date.setHours(0, 0, 0, 0);
  const diff = (weekday - date.getDay() + 7) % 7;
  return addDays(date, diff);
}

function makeShortWindows(startDate) {
  const windows = [];
  const weekThursday = nextWeekdayOnOrAfter(startDate, 4);

  for (let index = 0; index < 8; index += 1) {
    const thursday = addDays(weekThursday, index * 7);
    const friday = addDays(thursday, 1);
    const sunday = addDays(thursday, 3);
    const monday = addDays(thursday, 4);
    const tuesday = addDays(thursday, 5);

    const hasLongWeekendHoliday = SG_PUBLIC_HOLIDAYS.has(toIsoDate(friday)) || SG_PUBLIC_HOLIDAYS.has(toIsoDate(monday));

    windows.push({
      id: `thu-sun-${toIsoDate(thursday)}`,
      label: `Thu to Sun ${toIsoDate(thursday)} -> ${toIsoDate(sunday)}`,
      tripType: 'short',
      outboundDate: toIsoDate(thursday),
      outboundAfter: '16:30',
      returnCandidates: [
        { date: toIsoDate(sunday), after: '15:00', before: null, reason: 'primary' },
        { date: toIsoDate(monday), after: null, before: '09:00', reason: 'fallback-office' },
      ],
    });

    windows.push({
      id: `fri-mon-${toIsoDate(friday)}`,
      label: `Fri to Mon ${toIsoDate(friday)} -> ${toIsoDate(monday)}`,
      tripType: 'short',
      outboundDate: toIsoDate(friday),
      outboundAfter: '16:30',
      returnCandidates: [
        { date: toIsoDate(monday), after: '15:00', before: null, reason: 'primary' },
        { date: toIsoDate(tuesday), after: null, before: '09:00', reason: 'fallback-office' },
      ],
    });

    if (hasLongWeekendHoliday) {
      windows.push({
        id: `thu-mon-holiday-${toIsoDate(thursday)}`,
        label: `Thu to Mon holiday ${toIsoDate(thursday)} -> ${toIsoDate(monday)}`,
        tripType: 'short',
        outboundDate: toIsoDate(thursday),
        outboundAfter: '16:30',
        returnCandidates: [
          { date: toIsoDate(monday), after: '15:00', before: null, reason: 'holiday-primary' },
          { date: toIsoDate(tuesday), after: null, before: '09:00', reason: 'fallback-office' },
        ],
      });
    }
  }

  return windows;
}

function makeLongWindows(startDate) {
  const first = nextWeekdayOnOrAfter(startDate, 6);
  return [
    {
      id: `long-window-${toIsoDate(first)}`,
      label: `Long trip flexible ${toIsoDate(first)} -> ${toIsoDate(addDays(first, 11))}`,
      tripType: 'long',
      outboundDate: toIsoDate(first),
      outboundAfter: '08:00',
      returnCandidates: [{ date: toIsoDate(addDays(first, 11)), after: '10:00', before: null, reason: 'primary' }],
    },
  ];
}

function routeBasePrice(destination, tripType) {
  const mapping = {
    KUL: 170,
    HKT: 230,
    BKK: 250,
    DPS: 300,
    IPH: 210,
    DAD: 260,
    HAN: 270,
    SGN: 240,
    TYO: 760,
    OSA: 720,
    FUK: 730,
    SEL: 690,
  };

  const base = mapping[destination] || (tripType === 'short' ? 280 : 760);
  return base;
}

function pickAirline(routeType, seedValue) {
  const pool = FLIGHTS_CONFIG.preferredAirlines;
  const index = Math.floor(seeded(`${routeType}-${seedValue}`) * pool.length);
  return pool[index] || pool[0];
}

function computeOffer({ destination, window, routeType }) {
  const seedKey = `${destination}-${window.id}`;
  const isLong = routeType === 'long';
  const base = routeBasePrice(destination, routeType);
  const variance = Math.round((seeded(`price-${seedKey}`) - 0.5) * (isLong ? 220 : 110));
  const timeEffect = Math.round((seeded(`daily-${toIsoDate(new Date())}-${destination}`) - 0.5) * (isLong ? 120 : 60));
  const totalPrice = Math.max(90, base + variance + timeEffect);

  const durationMinutes = isLong
    ? 420 + Math.round(seeded(`duration-${seedKey}`) * 300)
    : 70 + Math.round(seeded(`duration-${seedKey}`) * 180);

  const stopChance = seeded(`stops-${seedKey}`);
  const stops = isLong && FLIGHTS_CONFIG.longTripAllowOneStop && stopChance > 0.58 ? 1 : 0;
  const cabin = seeded(`cabin-${seedKey}`) > 0.75 ? 'economy premium' : 'economy';
  const baggageIncluded = seeded(`bag-${seedKey}`) > 0.35;
  const airline = pickAirline(routeType, seedKey);

  const returnPrimary = window.returnCandidates[0];
  const itineraryKey = `${FLIGHTS_CONFIG.homeAirport}-${destination}-${window.outboundDate}-${returnPrimary.date}-${returnPrimary.after || returnPrimary.before || '00:00'}-${stops}`;

  return {
    itineraryKey,
    routeType,
    origin: FLIGHTS_CONFIG.homeAirport,
    destination,
    windowId: window.id,
    windowLabel: window.label,
    outboundDate: window.outboundDate,
    outboundAfter: window.outboundAfter,
    returnDate: returnPrimary.date,
    returnAfter: returnPrimary.after,
    returnBefore: returnPrimary.before,
    returnFallback: window.returnCandidates[1] || null,
    totalPrice,
    currency: FLIGHTS_CONFIG.currency,
    cabin,
    stops,
    airline,
    baggageIncluded,
    durationMinutes,
  };
}

function scoreDeal(deal) {
  const budget = deal.routeType === 'short' ? FLIGHTS_CONFIG.shortTripMaxPrice : FLIGHTS_CONFIG.longTripMaxPrice;
  const budgetScore = Math.max(0, 100 - ((deal.totalPrice / budget) * 100));
  const durationPenalty = Math.floor(deal.durationMinutes / 40);
  const baggageBonus = deal.baggageIncluded ? 8 : 0;
  const stopPenalty = deal.stops === 0 ? 0 : 12;
  const premiumPenalty = deal.cabin === 'economy premium' ? 3 : 0;
  return budgetScore + baggageBonus - durationPenalty - stopPenalty - premiumPenalty;
}

function shouldIncludeByRules(deal) {
  if (!FLIGHTS_CONFIG.cabinClasses.includes(deal.cabin)) return false;

  if (deal.routeType === 'short') {
    if (deal.totalPrice > FLIGHTS_CONFIG.shortTripMaxPrice) return false;
    if (FLIGHTS_CONFIG.shortTripDirectOnly && deal.stops > 0) return false;
  } else {
    if (deal.totalPrice > FLIGHTS_CONFIG.longTripMaxPrice) return false;
    if (!FLIGHTS_CONFIG.longTripAllowOneStop && deal.stops > 0) return false;
    if (deal.stops > 1) return false;
  }

  return true;
}

function msSince(date) {
  if (!date) return Number.POSITIVE_INFINITY;
  return Date.now() - date.getTime();
}

async function applyStateAndAlertLogic(deal) {
  const now = new Date();
  const currentPrice = deal.totalPrice;
  const existing = await prisma.flightDealState.findUnique({
    where: { itineraryKey: deal.itineraryKey },
  });

  const meaningfulDrop = existing
    ? existing.lastSeenPrice - currentPrice >= FLIGHTS_CONFIG.alert.minDropSgd
    : false;

  const cooldownPassed = existing?.lastAlertAt
    ? msSince(existing.lastAlertAt) >= FLIGHTS_CONFIG.alert.cooldownHours * 60 * 60 * 1000
    : true;

  const alert = meaningfulDrop && cooldownPassed;

  await prisma.flightDealState.upsert({
    where: { itineraryKey: deal.itineraryKey },
    create: {
      itineraryKey: deal.itineraryKey,
      routeType: deal.routeType,
      origin: deal.origin,
      destination: deal.destination,
      windowLabel: deal.windowLabel,
      outboundDate: toUtcStartOfDate(deal.outboundDate),
      returnDate: toUtcStartOfDate(deal.returnDate),
      lastSeenPrice: currentPrice,
      currency: deal.currency,
      cabin: deal.cabin,
      stops: deal.stops,
      airline: deal.airline,
      baggageIncluded: deal.baggageIncluded,
      lastSeenAt: now,
      lastAlertPrice: alert ? currentPrice : null,
      lastAlertAt: alert ? now : null,
    },
    update: {
      routeType: deal.routeType,
      origin: deal.origin,
      destination: deal.destination,
      windowLabel: deal.windowLabel,
      outboundDate: toUtcStartOfDate(deal.outboundDate),
      returnDate: toUtcStartOfDate(deal.returnDate),
      lastSeenPrice: currentPrice,
      currency: deal.currency,
      cabin: deal.cabin,
      stops: deal.stops,
      airline: deal.airline,
      baggageIncluded: deal.baggageIncluded,
      lastSeenAt: now,
      lastAlertPrice: alert ? currentPrice : existing?.lastAlertPrice ?? null,
      lastAlertAt: alert ? now : existing?.lastAlertAt ?? null,
    },
  });

  return {
    ...deal,
    alert,
    meaningfulDrop,
    lastSeenPrice: existing?.lastSeenPrice ?? currentPrice,
  };
}

function minutesToDurationLabel(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${minutes}m`;
}

export default async function flightRoutes(fastify) {
  fastify.get('/flights/scout', async (request, reply) => {
    try {
      const now = new Date();
      const shortWindows = makeShortWindows(now);
      const longWindows = makeLongWindows(now);

      const shortDeals = [];
      const longDeals = [];

      for (const destination of FLIGHTS_CONFIG.shortDestinations) {
        for (const window of shortWindows) {
          const deal = computeOffer({ destination, window, routeType: 'short' });
          if (!shouldIncludeByRules(deal)) continue;
          const withState = await applyStateAndAlertLogic(deal);
          shortDeals.push({
            ...withState,
            score: scoreDeal(withState),
            durationLabel: minutesToDurationLabel(withState.durationMinutes),
          });
        }
      }

      for (const destination of FLIGHTS_CONFIG.longDestinations) {
        for (const window of longWindows) {
          const deal = computeOffer({ destination, window, routeType: 'long' });
          if (!shouldIncludeByRules(deal)) continue;
          const withState = await applyStateAndAlertLogic(deal);
          longDeals.push({
            ...withState,
            score: scoreDeal(withState),
            durationLabel: minutesToDurationLabel(withState.durationMinutes),
          });
        }
      }

      const rankedShort = shortDeals.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice).slice(0, 20);
      const rankedLong = longDeals.sort((a, b) => b.score - a.score || a.totalPrice - b.totalPrice).slice(0, 20);

      return {
        success: true,
        source: 'internal-flight-scout-simulator',
        generatedAt: new Date().toISOString(),
        scanPolicy: {
          timezone: FLIGHTS_CONFIG.timezone,
          meaningfulDropSgd: FLIGHTS_CONFIG.alert.minDropSgd,
          cooldownHours: FLIGHTS_CONFIG.alert.cooldownHours,
          notes: 'Legal production fare provider not yet configured. Results are ranked simulation with persisted anti-noise state.',
        },
        config: {
          homeAirport: FLIGHTS_CONFIG.homeAirport,
          shortTripMaxPrice: FLIGHTS_CONFIG.shortTripMaxPrice,
          longTripMaxPrice: FLIGHTS_CONFIG.longTripMaxPrice,
          cabinClasses: FLIGHTS_CONFIG.cabinClasses,
          preferredAirlines: FLIGHTS_CONFIG.preferredAirlines,
          shortDestinations: FLIGHTS_CONFIG.shortDestinations,
          longDestinations: FLIGHTS_CONFIG.longDestinations,
          shortTripDirectOnly: FLIGHTS_CONFIG.shortTripDirectOnly,
          longTripAllowOneStop: FLIGHTS_CONFIG.longTripAllowOneStop,
        },
        windows: {
          short: shortWindows,
          long: longWindows,
        },
        deals: {
          short: rankedShort,
          long: rankedLong,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error.message || 'Failed to build flights scout output',
      };
    }
  });
}
