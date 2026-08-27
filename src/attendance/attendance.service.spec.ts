/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      client: {
        attendance: {
          create: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          findFirst: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        CaslAbilityFactory, // dùng thật
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('checkIn', () => {
    it('chặn khi đã đủ 4 lần check-in hôm nay', async () => {
      prisma.client.attendance.count.mockResolvedValue(4);
      await expect(service.checkIn(1)).rejects.toThrow('Checkin over times!');
      expect(prisma.client.attendance.create).not.toHaveBeenCalled();
    });

    it('chặn khi check-in quá gần lần trước (<5 phút)', async () => {
      prisma.client.attendance.count.mockResolvedValue(1);
      prisma.client.attendance.findFirst.mockResolvedValue({
        checkTime: new Date(Date.now() - 1 * 60 * 1000), // 1 phút trước
      });
      await expect(service.checkIn(1)).rejects.toThrow(
        'Must wait at least 5 minutes',
      );
      expect(prisma.client.attendance.create).not.toHaveBeenCalled();
    });

    it('cho phép tạo check-in khi hợp lệ (chưa đủ 4, cách đủ 5 phút)', async () => {
      prisma.client.attendance.count.mockResolvedValue(1);
      prisma.client.attendance.findFirst.mockResolvedValue({
        checkTime: new Date(Date.now() - 10 * 60 * 1000), // 10 phút trước
      });
      const mockResult = { id: 1, userId: 5, checkTime: new Date() };
      prisma.client.attendance.create.mockResolvedValue(mockResult);

      const result = await service.checkIn(5);

      expect(prisma.client.attendance.create).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('showHistory', () => {
    it('gọi findMany với điều kiện CASL, không filter thời gian nếu không truyền from/to', async () => {
      prisma.client.attendance.findMany.mockResolvedValue([]);
      await service.showHistory({ userId: 1, role: 'EMPLOYEE' });
      const callArgs = prisma.client.attendance.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toHaveLength(1);
    });

    it('thêm điều kiện checkTime khi có from/to', async () => {
      prisma.client.attendance.findMany.mockResolvedValue([]);
      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      await service.showHistory({ userId: 1, role: 'EMPLOYEE' }, from, to);
      const callArgs = prisma.client.attendance.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toHaveLength(2);
      expect(callArgs.where.AND[1].checkTime).toEqual({ gte: from, lte: to });
    });

    it('tự lọc theo userId khi role là EMPLOYEE (qua CASL thật)', async () => {
      prisma.client.attendance.findMany.mockResolvedValue([]);
      await service.showHistory({ userId: 1, role: 'EMPLOYEE' });
      const callArgs = prisma.client.attendance.findMany.mock.calls[0][0];
      expect(JSON.stringify(callArgs.where.AND[0])).toContain('1');
    });
  });
});
