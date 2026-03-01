const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIST(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + IST_OFFSET_MS);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function nowIST(): Date {
  return toIST(new Date());
}

export function formatTimestamp(date?: Date): string {
  const d = date ? toIST(date) : nowIST();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatDate(date?: Date): string {
  const d = date ? toIST(date) : nowIST();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayDateString(): string {
  return formatDate();
}
