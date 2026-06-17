export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'overnight';

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: 'Café da Manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
  overnight: 'Pernoite',
};

export const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '☕',
  lunch: '🍽️',
  dinner: '🍴',
  overnight: '🏨',
};

export interface MealRates {
  breakfast: number;
  lunch: number;
  dinner: number;
  overnight: number;
}

export const DEFAULT_RATES: MealRates = {
  breakfast: 27.36,
  lunch: 109.44,
  dinner: 109.44,
  overnight: 0,
};

// Time windows (minutes from midnight) — a meal is earned if duty OVERLAPS this window
const MEAL_WINDOWS: Record<Exclude<MealType, 'overnight'>, [number, number]> = {
  breakfast: [6 * 60, 9 * 60],         // 06:00-09:00
  lunch:     [11 * 60 + 30, 14 * 60],  // 11:30-14:00
  dinner:    [18 * 60, 21 * 60],        // 18:00-21:00
};

function timeToMin(t: string | null | undefined): number {
  if (!t) return -1;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? -1 : h * 60 + m;
}

function overlaps(s1: number, e1: number, s2: number, e2: number) {
  return s1 < e2 && e1 > s2;
}

// Brazilian IATA airport set
const BR: Set<string> = new Set([
  'GRU','GIG','BSB','FOR','SSA','REC','POA','CWB','BEL','MAO',
  'CGH','SDU','VCP','CNF','FLN','NAT','AJU','THE','MCZ','CGB',
  'IGU','JPA','PMW','PVH','SLZ','UDI','VIX','XAP','CXJ','BVB',
  'GYN','JOI','MCP','PHB','RAO','SJP','SJK','TOW','PPB','CAC',
  'CFB','IOS','IPN','JDO','LDB','MCZ','MGF','MNX','MOC','NVT',
  'OAL','PBZ','PFB','PIL','PSN','QCJ','REC','SBJ','SCL','STM',
  'TFF','UBA','VDC',
]);

function isNat(dep?: string | null, arr?: string | null) {
  const d = dep?.slice(0, 3).toUpperCase();
  const a = arr?.slice(0, 3).toUpperCase();
  return (!d || BR.has(d)) && (!a || BR.has(a));
}

export function isNationalRoute(legs: Array<{ departure?: string | null; arrival?: string | null }>): boolean {
  return legs.every(l => isNat(l.departure, l.arrival));
}

export interface ComputedMeal {
  type: MealType;
  value: number;
  isNational: boolean;
  activityLabel: string;
}

export interface ComputedDutyPerDiem {
  dutyId: string;
  date: string;
  routeSummary: string;
  meals: ComputedMeal[];
  total: number;
  hasOvernight: boolean;
}

type LegSlice = {
  departure?: string | null;
  arrival?: string | null;
  hotel_name?: string | null;
  overnight?: boolean;
  activity_type?: string | null;
  activity_label?: string | null;
};

export function computeDutyPerDiem(
  duty: {
    id: string;
    dutyStartDate: string;
    routeSummary: string;
    reportTime: string | null;
    debriefTime: string | null;
    legs: LegSlice[];
  },
  rates: MealRates,
): ComputedDutyPerDiem | null {
  // Use report_time or fall back to first departure_time
  const startTimeRaw = duty.reportTime
    ?? (duty.legs.find(l => l.activity_type) as LegSlice & { departure_time?: string })?.departure_time
    ?? null;

  const startMin = timeToMin(startTimeRaw);
  if (startMin < 0) return null;

  let endMin = duty.debriefTime ? timeToMin(duty.debriefTime) : startMin + 8 * 60;
  if (endMin < startMin) endMin += 24 * 60; // overnight duty

  const flightLegs = duty.legs.filter(l => l.departure || l.arrival);
  const national = isNationalRoute(flightLegs.length > 0 ? flightLegs : duty.legs);

  const actLabel =
    duty.legs.find(l => l.activity_label)?.activity_label ||
    duty.legs.find(l => l.activity_type && !['VOO','APR'].includes(l.activity_type ?? ''))?.activity_type ||
    (national ? 'Nacional' : 'Internacional');

  const meals: ComputedMeal[] = [];

  for (const [type, [ws, we]] of Object.entries(MEAL_WINDOWS) as [Exclude<MealType,'overnight'>, [number,number]][]) {
    if (rates[type] <= 0) continue;
    if (overlaps(startMin, endMin, ws, we)) {
      meals.push({ type, value: rates[type], isNational: national, activityLabel: actLabel as string });
    }
  }

  const hasOvernight = duty.legs.some(l => l.hotel_name || l.overnight);
  if (hasOvernight && rates.overnight > 0) {
    meals.push({ type: 'overnight', value: rates.overnight, isNational: national, activityLabel: actLabel as string });
  }

  if (meals.length === 0) return null;

  return {
    dutyId: duty.id,
    date: duty.dutyStartDate,
    routeSummary: duty.routeSummary,
    meals,
    total: meals.reduce((s, m) => s + m.value, 0),
    hasOvernight,
  };
}

const RATES_KEY = 'escalax_perdiem_rates';

export function loadRates(): MealRates {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    if (raw) return { ...DEFAULT_RATES, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_RATES };
}

export function saveRates(r: MealRates) {
  localStorage.setItem(RATES_KEY, JSON.stringify(r));
}
