const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function dateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dayStart(date: Date): Date {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => p.find((x) => x.type === t)!.value;

  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));

  // 00:00 giờ VN = 17:00 UTC của NGÀY TRƯỚC (VN = UTC+7)
  // Date.UTC(y, m-1, d) tạo mốc 00:00 UTC của đúng ngày y-m-d,
  // trừ đi 7 tiếng cho ra đúng 00:00 giờ VN quy đổi sang UTC — KHÔNG dùng getTimezoneOffset
  const utcEpoch = Date.UTC(year, month - 1, day) - 7 * 3600000;

  return new Date(utcEpoch);
}

export function dayEnd(date: Date): Date {
  const start = dayStart(date);
  return new Date(start.getTime() + 24 * 3600000 - 1);
}

export function monthStart(year: number, month: number): Date {
  return dayStart(new Date(Date.UTC(year, month - 1, 1)));
}

export function nextMonthStart(year: number, month: number): Date {
  return dayStart(new Date(Date.UTC(year, month, 1)));
}

export function businessTime(date: Date): { year: number; month: number } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { year: get('year'), month: get('month') };
}
