/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AttendanceRequestService } from './attendance-request.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { NotificationGateway } from '../notification/notification.gateway';

describe('AttendanceRequestService', () => {
  let service: AttendanceRequestService;
  let prisma: any;
  let notificationGateway: { notifyUser: jest.Mock };

  beforeEach(async () => {
    prisma = {
      client: {
        $transaction: jest.fn(),
        attendanceRequest: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        attendance: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      },
    };

    notificationGateway = { notifyUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceRequestService,
        { provide: PrismaService, useValue: prisma },
        { provide: CaslAbilityFactory, useValue: { createForUser: jest.fn() } },
        { provide: NotificationGateway, useValue: notificationGateway },
      ],
    }).compile();

    service = module.get<AttendanceRequestService>(AttendanceRequestService);
  });

  afterEach(() => jest.clearAllMocks());

  // ============ createRequest ============
  describe('createRequest', () => {
    const validInput = {
      startTime: new Date('2026-08-20T08:00:00'),
      endTime: new Date('2026-08-20T17:00:00'),
      reason: 'Quên chấm công',
    };

    it('throw nếu startTime >= endTime', async () => {
      const input = {
        ...validInput,
        startTime: new Date('2026-08-20T17:00:00'),
        endTime: new Date('2026-08-20T08:00:00'),
      };
      await expect(service.createRequest(1, input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throw nếu startTime và endTime khác ngày', async () => {
      const input = {
        ...validInput,
        startTime: new Date('2026-08-20T08:00:00'),
        endTime: new Date('2026-08-21T17:00:00'),
      };
      await expect(service.createRequest(1, input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('tạo request thành công với input hợp lệ (trong quá khứ)', async () => {
      prisma.client.attendanceRequest.create.mockResolvedValue({
        id: 1,
        ...validInput,
      });
      const result = await service.createRequest(1, validInput);
      expect(prisma.client.attendanceRequest.create).toHaveBeenCalledWith({
        data: { userId: 1, ...validInput },
      });
      expect(result).toEqual({ id: 1, ...validInput });
    });

    it('chặn khi đơn mới chồng lấn với đơn cũ đang chờ/đã duyệt', async () => {
      prisma.client.attendanceRequest.findMany.mockResolvedValue([{ id: 2 }]);
      await expect(service.createRequest(1, validInput)).rejects.toThrow(
        'Request overlaps with an existing request',
      );
      expect(prisma.client.attendanceRequest.create).not.toHaveBeenCalled();
    });
  });

  // ============ approveRequest ============
  describe('approveRequest', () => {
    it('throw nếu request không tồn tại', async () => {
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });

      await expect(service.approveRequest(999, { userId: 5 })).rejects.toThrow(
        'Request not found!',
      );
    });

    it('chặn admin tự duyệt đơn của chính mình (ForbiddenException)', async () => {
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 5 }),
          },
        };
        return callback(tx);
      });

      await expect(service.approveRequest(1, { userId: 5 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throw nếu đơn đã bị xử lý bởi request khác (race condition)', async () => {
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 99 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(tx);
      });

      await expect(service.approveRequest(1, { userId: 5 })).rejects.toThrow(
        'Request is processing or not found!',
      );
    });

    it('tạo 2 bản ghi Attendance và gửi thông báo khi duyệt thành công', async () => {
      const mockRequest = {
        id: 1,
        userId: 10,
        startTime: new Date('2026-08-20T08:00:00'),
        endTime: new Date('2026-08-20T17:00:00'),
      };
      const finalResult = { ...mockRequest, status: 'APPROVED' };

      let createManyArgs: any = null;

      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue(mockRequest),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(finalResult),
            findMany: jest.fn().mockResolvedValue([]),
          },
          attendance: {
            createMany: jest.fn().mockImplementation((args) => {
              createManyArgs = args;
              return Promise.resolve({ count: 2 });
            }),
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return callback(tx);
      });

      const result = await service.approveRequest(1, { userId: 99 });

      expect(createManyArgs.data).toHaveLength(2);
      expect(createManyArgs.data[0]).toMatchObject({
        userId: 10,
        checkTime: mockRequest.startTime,
        type: 'MANUAL',
        attendanceRequestId: 1,
      });
      expect(notificationGateway.notifyUser).toHaveBeenCalledWith(
        10,
        'requestApproved',
        expect.objectContaining({ requestId: 1, status: 'APPROVED' }),
      );
      expect(result).toEqual(finalResult);
    });

    it('chặn approve khi chồng lấn với đơn khác đã APPROVED', async () => {
      const mockRequest = {
        id: 1,
        userId: 10,
        startTime: new Date('2026-08-20T08:00:00'),
        endTime: new Date('2026-08-20T17:00:00'),
      };
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue(mockRequest),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findMany: jest
              .fn()
              .mockResolvedValue([{ id: 2, status: 'APPROVED' }]),
            findUniqueOrThrow: jest.fn(),
          },
          attendance: {
            createMany: jest.fn(),
          },
        };
        return callback(tx);
      });

      await expect(service.approveRequest(1, { userId: 99 })).rejects.toThrow(
        'Request overlaps with an already approved request',
      );
    });
  });

  // ============ rejectRequest ============
  describe('rejectRequest', () => {
    it('throw nếu request không tồn tại', async () => {
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        return callback(tx);
      });

      await expect(service.rejectRequest(999, { userId: 5 })).rejects.toThrow(
        'Request not found!',
      );
    });

    it('chặn tự từ chối đơn của chính mình (ForbiddenException)', async () => {
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 5 }),
          },
        };
        return callback(tx);
      });

      await expect(service.rejectRequest(1, { userId: 5 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throw nếu đơn đã bị xử lý trước đó', async () => {
      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 99 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(tx);
      });

      await expect(service.rejectRequest(1, { userId: 5 })).rejects.toThrow(
        'Request is processing or not found!',
      );
    });

    it('reject thành công và gửi thông báo', async () => {
      const mockRequest = { id: 1, userId: 10 };
      const finalResult = { ...mockRequest, status: 'REJECTED' };

      prisma.client.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          attendanceRequest: {
            findUnique: jest.fn().mockResolvedValue(mockRequest),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue(finalResult),
          },
        };
        return callback(tx);
      });

      const result = await service.rejectRequest(
        1,
        { userId: 99 },
        'Không hợp lệ',
      );

      expect(notificationGateway.notifyUser).toHaveBeenCalledWith(
        10,
        'requestRejected',
        expect.objectContaining({ requestId: 1, status: 'REJECTED' }),
      );
      expect(result).toEqual(finalResult);
    });
  });
});
