import { dayStart, dayEnd, dateKey, monthStart } from './date.util';

// Bài học từ review: code xử lý múi giờ PHẢI được chạy dưới nhiều múi giờ máy
// khác nhau, nếu không sẽ bỏ lọt lỗi phụ thuộc múi giờ (vd getTimezoneOffset).
// Đã xác nhận trên máy này: đổi process.env.TZ có hiệu lực với Date/Intl.
// Ngoài ra vẫn có thể chạy lại từ ngoài: TZ=UTC npx jest ... / TZ=America/New_York npx jest ...

const origTZ = process.env.TZ;

afterAll(() => {
  process.env.TZ = origTZ;
});

const HOST_ZONES = ['UTC', 'America/New_York'];

describe('date.util – dayStart/dayEnd/dateKey/monthStart theo múi giờ nghiệp vụ VN', () => {
  for (const tz of HOST_ZONES) {
    describe(`khi máy chủ chạy TZ=${tz}`, () => {
      beforeEach(() => {
        process.env.TZ = tz;
      });

      it('dayStart(2026-08-20T12:00Z) = 00:00 giờ VN (19/08 17:00Z)', () => {
        const r = dayStart(new Date('2026-08-20T12:00:00Z'));
        expect(r.toISOString()).toBe('2026-08-19T17:00:00.000Z');
      });

      it('dayEnd(2026-08-20T12:00Z) = 23:59:59.999 giờ VN (20/08 16:59:59.999Z)', () => {
        const r = dayEnd(new Date('2026-08-20T12:00:00Z'));
        expect(r.toISOString()).toBe('2026-08-20T16:59:59.999Z');
      });

      it('dateKey(2026-08-20T12:00Z) = "2026-08-20"', () => {
        expect(dateKey(new Date('2026-08-20T12:00:00Z'))).toBe('2026-08-20');
      });

      it('monthStart(2026, 8) = 00:00 VN ngày 01/08 (31/07 17:00Z)', () => {
        const r = monthStart(2026, 8);
        expect(r.toISOString()).toBe('2026-07-31T17:00:00.000Z');
      });
    });
  }
});