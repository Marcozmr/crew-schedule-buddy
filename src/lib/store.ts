import { ScheduleEntry, CrewMember } from './types';

const SCHEDULE_KEY = 'escalax_schedule';
const USER_KEY = 'escalax_user';

export function getSchedule(): ScheduleEntry[] {
  const data = localStorage.getItem(SCHEDULE_KEY);
  return data ? JSON.parse(data) : [];
}

export function saveSchedule(entries: ScheduleEntry[]) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(entries));
}

export function addScheduleEntries(entries: ScheduleEntry[]) {
  const current = getSchedule();
  const merged = [...current, ...entries];
  saveSchedule(merged);
  return merged;
}

export function getUser(): CrewMember | null {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export function saveUser(user: CrewMember) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function detectAirline(text: string): string {
  const airlines: Record<string, string[]> = {
    'LATAM': ['latam', 'la ', 'jj ', 'tam'],
    'GOL': ['gol', 'g3 ', 'glo'],
    'Azul': ['azul', 'ad ', 'azu'],
    'VOEPASS': ['voepass', 'passaredo', '2z '],
    'Avianca': ['avianca', 'o6 '],
    'American Airlines': ['american', 'aa '],
    'United': ['united', 'ua '],
    'Delta': ['delta', 'dl '],
    'Emirates': ['emirates', 'ek '],
    'Qatar Airways': ['qatar', 'qr '],
  };

  const lower = text.toLowerCase();
  for (const [airline, keywords] of Object.entries(airlines)) {
    if (keywords.some(k => lower.includes(k))) return airline;
  }
  return 'Não identificada';
}

export function parseMockSchedule(text: string): ScheduleEntry[] {
  const lines = text.split('\n').filter(l => l.trim());
  const entries: ScheduleEntry[] = [];
  const airline = detectAirline(text);

  for (const line of lines) {
    const dateMatch = line.match(/(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
    const flightMatch = line.match(/([A-Z]{2}\s?\d{3,4})/i);
    const airportMatch = line.match(/([A-Z]{3})\s*[-–>]\s*([A-Z]{3})/);
    const timeMatch = line.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);

    if (dateMatch && flightMatch) {
      entries.push({
        id: crypto.randomUUID(),
        date: dateMatch[1],
        flightNumber: flightMatch[1].replace(/\s/g, ''),
        departure: airportMatch?.[1] || 'TBD',
        arrival: airportMatch?.[2] || 'TBD',
        departureTime: timeMatch?.[1] || '00:00',
        arrivalTime: timeMatch?.[2] || '00:00',
        status: 'scheduled',
        airline,
        reportTime: timeMatch?.[1] ? calculateReportTime(timeMatch[1]) : undefined,
        dutyHours: timeMatch ? calculateDutyHours(timeMatch[1], timeMatch[2]) : undefined,
      });
    }
  }
  return entries;
}

function calculateReportTime(departureTime: string): string {
  const [h, m] = departureTime.split(':').map(Number);
  const reportMinutes = h * 60 + m - 60;
  const rh = Math.floor((reportMinutes + 1440) % 1440 / 60);
  const rm = (reportMinutes + 1440) % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

function calculateDutyHours(dep: string, arr: string): number {
  const [dh, dm] = dep.split(':').map(Number);
  const [ah, am] = arr.split(':').map(Number);
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 1440;
  return Math.round((diff / 60) * 10) / 10;
}
