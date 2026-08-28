/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
jest.mock('exceljs', () => {
  const mockAddRow = jest.fn();
  const mockWorksheet = {
    columns: [],
    addRow: mockAddRow,
  };
  const mockWorkbook = {
    addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
    xlsx: { writeFile: jest.fn().mockResolvedValue(undefined) },
  };

  return {
    Workbook: jest.fn().mockImplementation(() => mockWorkbook),
  };
});

jest.mock('fs');

import { Test, TestingModule } from '@nestjs/testing';
import { ExportProcessor } from './export.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationGateway } from '../notification/notification.gateway';
import * as fs from 'fs';

describe('ExportProcessor', () => {
  let processor: ExportProcessor;
  let prisma: any;
  let notificationGateway: { notifyUser: jest.Mock; notifyAdmin: jest.Mock };

  beforeEach(async () => {
    prisma = {
      client: {
        exportJob: { updateMany: jest.fn(), update: jest.fn() },
        attendance: { findMany: jest.fn().mockResolvedValue([]) },
      },
    };
    notificationGateway = { notifyUser: jest.fn(), notifyAdmin: jest.fn() };

    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationGateway, useValue: notificationGateway },
      ],
    }).compile();

    processor = module.get<ExportProcessor>(ExportProcessor);
  });

  afterEach(() => jest.clearAllMocks());

  const mockJob = {
    data: { exportId: 'EXP-1', month: 7, year: 2026 },
  } as any;

  it('nên gọi notifyUser nếu exportedBy có giá trị (Admin trigger tay)', async () => {
    prisma.client.exportJob.update.mockResolvedValue({
      exportedBy: 99,
      exportMonth: 7,
      exportYear: 2026,
    });

    await processor.process(mockJob);

    expect(notificationGateway.notifyUser).toHaveBeenCalledWith(
      99,
      'exportCompleted',
      expect.any(Object),
    );
    expect(notificationGateway.notifyAdmin).not.toHaveBeenCalled();
  });

  it('nên gọi notifyAdmin nếu exportedBy là null (Cron tự động trigger)', async () => {
    prisma.client.exportJob.update.mockResolvedValue({
      exportedBy: null,
      exportMonth: 7,
      exportYear: 2026,
    });

    await processor.process(mockJob);

    expect(notificationGateway.notifyAdmin).toHaveBeenCalledWith(
      'exportCompleted',
      expect.any(Object),
    );
    expect(notificationGateway.notifyUser).not.toHaveBeenCalled();
  });

  it('nên set status FAILED và gọi notify khi có lỗi xảy ra', async () => {
    prisma.client.attendance.findMany.mockRejectedValue(new Error('DB error'));
    prisma.client.exportJob.update.mockResolvedValue({
      exportedBy: 99,
      exportMonth: 7,
      exportYear: 2026,
    });

    await expect(processor.process(mockJob)).rejects.toThrow('DB error');

    expect(prisma.client.exportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', reason: 'DB error' }),
      }),
    );
    expect(notificationGateway.notifyUser).toHaveBeenCalledWith(
      99,
      'exportFailed',
      expect.any(Object),
    );
  });
});
