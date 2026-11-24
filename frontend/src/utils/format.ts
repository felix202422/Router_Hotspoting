/**
 * Formatting helpers — TZS money, durations, dates in Africa/Dar_es_Salaam
 * (FR-R02: ALL reporting boundaries use this timezone).
 */

const TZ = 'Africa/Dar_es_Salaam';

const tzDateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const tzDateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const tzTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** 2000 → "2,000" ; always integer TZS. */
export function formatTzs(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

/** 2000 → "TZS 2,000" */
export function formatTzsFull(amount: number): string {
  return `TZS ${formatTzs(amount)}`;
}

/** 86400 → "24 hours"; 3600 → "1 hour"; 604800 → "7 days". */
export function formatDuration(seconds: number): string {
  if (seconds % 86400 === 0) {
    const d = seconds / 86400;
    return `${d} day${d > 1 ? 's' : ''}`;
  }
  if (seconds % 3600 === 0) {
    const h = seconds / 3600;
    return `${h} hour${h > 1 ? 's' : ''}`;
  }
  if (seconds % 60 === 0) {
    const m = seconds / 60;
    return `${m} min`;
  }
  return `${seconds}s`;
}

/** ISO → "23 Nov 2026" (Dar es Salaam). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return tzDateFmt.format(new Date(iso));
}

/** ISO → "23 Nov, 17:05" (Dar es Salaam). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return tzDateTimeFmt.format(new Date(iso));
}

/** ISO → "17:05" (Dar es Salaam). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return tzTimeFmt.format(new Date(iso));
}

/** Seconds → "21h 43m" / "43m 12s". */
export function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Seconds → "1h 12m" for session durations (always compact). */
export function formatSessionDuration(seconds: number): string {
  return formatRemaining(seconds);
}

/** Bytes → human readable. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

/** kbps → "10 Mbps" / "512 Kbps". */
export function formatSpeed(kbps: number | null): string {
  if (kbps === null) return 'Unlimited';
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(kbps % 1000 === 0 ? 0 : 1)} Mbps`;
  return `${kbps} Kbps`;
}

/** +255712345678 → +255 712 345 678 (display only). */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+255(\d{2})(\d{3})(\d{3})(\d*)$/);
  if (!m) return phone;
  return `+255 ${m[1]} ${m[2]} ${m[3]}${m[4] ? ' ' + m[4] : ''}`;
}

/** Mask for table display: +255712345678 → +255 712 *** 678 */
export function maskPhone(phone: string): string {
  const m = phone.match(/^\+255(\d{2})(\d{3})(\d{3})(\d*)$/);
  if (!m) return phone;
  return `+255 ${m[1]} *** ${m[4] || m[3]}`;
}

/** Local "YYYY-MM-DD" in Dar es Salaam — used for date-filter defaults. */
export function todayInTz(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

/** Start of day (local TZ) offset by N days → YYYY-MM-DD. */
export function dateOffsetInTz(days: number): string {
  const d = new Date(Date.now() + days * 86400_000);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

/** ISO timestamp for "now" (mock backend clock). */
export function nowIso(): string {
  return new Date().toISOString();
}
