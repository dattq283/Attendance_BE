const TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Lấy chuỗi khóa "ngày làm việc" theo múi giờ nghiệp vụ, VD "2026-08-20".
 * Dùng để so "cùng ngày" — thay cho toDateString() (vốn theo timezone máy).
 */
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
  // Dựng mốc 00:00 theo giờ VN
  const startOfDayVn = new Date(
    `${get('year')}-${get('month')}-${get('day')}T00:00:00`,
  );
  const asUtcEpoch =
    startOfDayVn.getTime() +
    startOfDayVn.getTimezoneOffset() * 60000 -
    7 * 3600000;
  return new Date(asUtcEpoch);
}

/** Mốc kết thúc (23:59:59.999) của ngày làm việc theo múi giờ nghiệp vụ. */
export function dayEnd(date: Date): Date {
  const start = dayStart(date);
  return new Date(start.getTime() + 24 * 3600000 - 1);
}
/** Mốc đầu tháng (00:00:00) theo múi giờ nghiệp vụ. month: 1..12 */
export function monthStart(year: number, month: number): Date {
  return dayStart(new Date(Date.UTC(year, month - 1, 1)));
}

/** Mốc đầu tháng sau (giá trị <lt>) — an toàn khi month=12 */
export function nextMonthStart(year: number, month: number): Date {
  return dayStart(new Date(Date.UTC(year, month, 1)));
}
