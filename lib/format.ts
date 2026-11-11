const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "agora", "5 min", "3 h", "2 d", "4 sem" */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MIN) return 'agora';
  if (diff < HOUR) return `${Math.floor(diff / MIN)} min`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)} d`;
  return `${Math.floor(diff / WEEK)} sem`;
}

/** 1234 -> "1.234", 15300 -> "15,3 mil", 2100000 -> "2,1 mi" */
export function compactNumber(n: number): string {
  if (n < 10000) return n.toLocaleString('pt-BR');
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')} mil`;
  return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} mi`;
}

export function pluralize(n: number, singular: string, plural: string) {
  return `${compactNumber(n)} ${n === 1 ? singular : plural}`;
}

let counter = 0;
export function newId(prefix = 'id') {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}
