const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Masks free typing into YYYY-MM-DD as the user enters digits. */
export function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** "1994-05-12" → "12 May 1994" */
export function formatIsoDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** ISO timestamp → "May 2026" */
export function formatMonthYear(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMeasurement(value: number | null | undefined, unit: string): string | null {
  if (value === null || value === undefined) return null;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

/** Parses a decimal typed by the user ("72,5" or "72.5"); empty → null. */
export function parseDecimal(input: string): number | null | typeof NaN {
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// ---------------------------------------------------------------------------
// Running units (metric)
// ---------------------------------------------------------------------------

const pad2 = (value: number) => String(value).padStart(2, '0');

/** 754 → "12:34", 4000 → "1:06:40". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Compact total time for stats: "3h 12m", "45m". */
export function formatTotalTime(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h}h ${pad2(minutes % 60)}m` : `${minutes}m`;
}

/** Seconds per km → "5:07"; null → "–:––". */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0 || secondsPerKm > 60 * 60) return '–:––';
  const rounded = Math.round(secondsPerKm);
  return `${Math.floor(rounded / 60)}:${pad2(rounded % 60)}`;
}

/** Metres → "5.24" (km). */
export function formatKm(meters: number, digits = 2): string {
  return (Math.max(0, meters) / 1000).toFixed(digits);
}

/** m/s → "12.3" (km/h). */
export function formatSpeedKmh(metersPerSecond: number | null | undefined): string {
  if (metersPerSecond == null || !Number.isFinite(metersPerSecond)) return '–';
  return (metersPerSecond * 3.6).toFixed(1);
}

/** Trims to one decimal without a trailing ".0": 21.097 → "21.1", 5 → "5". */
export function formatCount(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/** "3.2 / 5 km"; goals with no measurable progress are shown as done or not. */
export function formatProgress(current: number, target: number, unit: 'km' | 'runs' | 'days' | 'weeks' | 'min' | 'goal'): string {
  if (unit === 'goal') return current >= target ? 'Done' : 'Not yet';
  return `${formatCount(current)} / ${formatCount(target)} ${unit}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu 6 Nov · 07:12" */
export function formatRunDate(input: string | number): string {
  const date = new Date(input);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "Morning run" etc. from the local start hour. */
export function runTitle(input: string | number): string {
  const hour = new Date(input).getHours();
  if (hour < 5) return 'Night run';
  if (hour < 12) return 'Morning run';
  if (hour < 17) return 'Afternoon run';
  if (hour < 21) return 'Evening run';
  return 'Night run';
}

export function weekdayInitial(isoDate: string): string {
  return WEEKDAYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()]!.slice(0, 1);
}

export function shortMonth(yearMonth: string): string {
  return MONTHS[Number(yearMonth.slice(5, 7)) - 1] ?? yearMonth;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
