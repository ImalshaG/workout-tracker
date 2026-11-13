/**
 * Local-time calendar helpers. Days are built with `new Date(y, m, d)` arithmetic (never by adding
 * 24h of milliseconds), so daylight-saving changes can't shift a day.
 */

export interface Month {
  year: number;
  /** 0-11 */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-05" in local time. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** "2026-11" */
export const monthKey = ({ year, month }: Month) => `${year}-${pad(month + 1)}`;
export const monthOf = (d: Date): Month => ({ year: d.getFullYear(), month: d.getMonth() });

export function parseDayKey(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : null;
}

export function parseMonthKey(s: string | null | undefined): Month | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const month = Number(m[2]) - 1;
  return month >= 0 && month <= 11 ? { year: Number(m[1]), month } : null;
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
export const inMonth = (d: Date, { year, month }: Month) => d.getFullYear() === year && d.getMonth() === month;

export function addMonths({ year, month }: Month, n: number): Month {
  const d = new Date(year, month + n, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** Same day-of-month in another month, clamped (31 Jan + 1 month -> 28/29 Feb). */
export function shiftMonthClamped(d: Date, n: number): Date {
  const target = addMonths(monthOf(d), n);
  const last = new Date(target.year, target.month + 1, 0).getDate();
  return new Date(target.year, target.month, Math.min(d.getDate(), last));
}

/** First day of the week for the user's locale (0 = Sunday … 6 = Saturday); Monday if unknown. */
export function localeWeekStart(locale = typeof navigator === 'undefined' ? 'en' : navigator.language): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = loc.getWeekInfo?.().firstDay ?? loc.weekInfo?.firstDay; // 1 = Monday … 7 = Sunday
    if (firstDay) return firstDay % 7;
  } catch {
    // fall through
  }
  return 1;
}

export const startOfWeek = (d: Date, weekStart: number) => addDays(d, -((d.getDay() - weekStart + 7) % 7));

/** The weeks covering a month, each 7 days, padded with days from neighbouring months. */
export function monthWeeks({ year, month }: Month, weekStart: number): Date[][] {
  const first = startOfWeek(new Date(year, month, 1), weekStart);
  const last = new Date(year, month + 1, 0);
  const weeks: Date[][] = [];
  for (let day = first; day <= last; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  return weeks;
}

/** Group items by the local day of a timestamp. */
export function groupByDay<T>(items: T[], time: (item: T) => number): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = dayKey(new Date(time(item)));
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/** "45 s", "4 min", "1 h 5 min" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
