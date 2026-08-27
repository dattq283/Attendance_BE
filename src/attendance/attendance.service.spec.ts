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
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        CaslAbilityFactory, // dùng THẬT, không mock
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('checkIn', () => {
    it('nên tạo bản ghi Attendance với checkTime hiện tại', async () => {
      const mockResult = {
        id: 1,
        userId: 5,
        checkTime: new Date(),
        type: 'NORMAL',
      };
      prisma.client.attendance.create.mockResolvedValue(mockResult);

      const result = await service.checkIn(5);

      expect(prisma.client.attendance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 5 }),
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('showHistory', () => {
    it('nên gọi findMany với điều kiện CASL, không filter thời gian nếu không truyền from/to', async () => {
      prisma.client.attendance.findMany.mockResolvedValue([]);

      await service.showHistory({ userId: 1, role: 'EMPLOYEE' });

      const callArgs = prisma.client.attendance.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toHaveLength(1);
    });

    it('nên thêm điều kiện checkTime khi có from/to', async () => {
      prisma.client.attendance.findMany.mockResolvedValue([]);

      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');

      await service.showHistory({ userId: 1, role: 'EMPLOYEE' }, from, to);

      const callArgs = prisma.client.attendance.findMany.mock.calls[0][0];
      expect(callArgs.where.AND).toHaveLength(2);
      expect(callArgs.where.AND[1].checkTime).toEqual({ gte: from, lte: to });
    });

    it('nên tự lọc theo userId khi role là EMPLOYEE (qua CASL thật)', async () => {
      prisma.client.attendance.findMany.mockResolvedValue([]);

      await service.showHistory({ userId: 1, role: 'EMPLOYEE' });

      const callArgs = prisma.client.attendance.findMany.mock.calls[0][0];
      // Kiểm tra điều kiện CASL đầu tiên có filter theo userId
      expect(JSON.stringify(callArgs.where.AND[0])).toContain('1');
    });
  });
});
