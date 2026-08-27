/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ExportService } from './export.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ExportService', () => {
  let service: ExportService;
  let prisma: any;
  let queue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      client: {
        exportJob: {
          create: jest.fn(),
          findFirst: jest.fn(),
        },
      },
    };
    queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('export'), useValue: queue },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('trgMonthlyExport', () => {
    it('throw nếu month không hợp lệ', async () => {
      await expect(service.trgMonthlyExport(13, 2026)).rejects.toThrow(
        'Invalid month!',
      );
      await expect(service.trgMonthlyExport(0, 2026)).rejects.toThrow(
        'Invalid month!',
      );
    });

    it('throw nếu year không hợp lệ', async () => {
      await expect(service.trgMonthlyExport(1, 0)).rejects.toThrow(
        'Invalid year!',
      );
    });

    it('tạo ExportJob TRƯỚC khi add vào Queue', async () => {
      prisma.client.exportJob.create.mockResolvedValue({});
      const callOrder: string[] = [];

      prisma.client.exportJob.create.mockImplementation(() => {
        callOrder.push('create');
        return Promise.resolve({});
      });
      queue.add.mockImplementation(() => {
        callOrder.push('queue.add');
        return Promise.resolve({ id: 'job-1' });
      });

      await service.trgMonthlyExport(7, 2026, 99);

      expect(callOrder).toEqual(['create', 'queue.add']);
      expect(prisma.client.exportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          exportMonth: 7,
          exportYear: 2026,
          exportedBy: 99,
          status: 'QUEUED',
        }),
      });
    });

    it('trả về exportId dạng chuỗi bắt đầu bằng EXP-', async () => {
      prisma.client.exportJob.create.mockResolvedValue({});

      const result = await service.trgMonthlyExport(7, 2026);

      expect(result).toMatch(/^EXP-/);
    });

    it('throw nếu Job không tạo được id', async () => {
      prisma.client.exportJob.create.mockResolvedValue({});
      queue.add.mockResolvedValue({ id: undefined });

      await expect(service.trgMonthlyExport(7, 2026)).rejects.toThrow(
        'Job ID was not created',
      );
    });
  });

  describe('getExportReport', () => {
    it('gọi findFirst với đúng exportId', async () => {
      prisma.client.exportJob.findFirst.mockResolvedValue({
        exportId: 'EXP-123',
      });

      const result = await service.getExportReport('EXP-123');

      expect(prisma.client.exportJob.findFirst).toHaveBeenCalledWith({
        where: { exportId: 'EXP-123' },
      });
      expect(result).toEqual({ exportId: 'EXP-123' });
    });
  });
});
