// Opening hours, evaluated in the branch's own time zone (Asia/Tehran by default).

export type HoursRange = [string, string]; // ["09:00", "16:00"]

export const DEFAULT_HOURS: HoursRange[] = [['09:00', '16:00'], ['17:00', '23:00']];
export const DEFAULT_TIMEZONE = 'Asia/Tehran';

const toMinutes = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
};

export function isValidHours(hours: unknown): hours is HoursRange[] {
  if (!Array.isArray(hours) || hours.length === 0 || hours.length > 6) return false;
  return hours.every((r) => {
    if (!Array.isArray(r) || r.length !== 2) return false;
    const [a, b] = r.map((x) => (typeof x === 'string' ? toMinutes(x) : NaN));
    return Number.isFinite(a) && Number.isFinite(b) && a! >= 0 && b! <= 24 * 60 && a! < b!;
  });
}

/** Minutes since local midnight in the given time zone. */
export function localMinutes(date: Date, timeZone = DEFAULT_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export interface OpenState {
  open: boolean;
  /** When open: the closing time of the current range. */
  closesAt?: string;
  /** When closed: the next opening time. */
  opensAt?: string;
  /** True when the next opening is tomorrow. */
  tomorrow?: boolean;
}

export function openState(hours: HoursRange[], date = new Date(), timeZone = DEFAULT_TIMEZONE): OpenState {
  const now = localMinutes(date, timeZone);
  const ranges = [...hours].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  for (const [from, to] of ranges) {
    if (now >= toMinutes(from) && now < toMinutes(to)) return { open: true, closesAt: to };
  }
  const next = ranges.find(([from]) => toMinutes(from) > now);
  if (next) return { open: false, opensAt: next[0], tomorrow: false };
  return { open: false, opensAt: ranges[0]?.[0], tomorrow: true };
}
