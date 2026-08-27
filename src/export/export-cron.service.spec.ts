import { Test, TestingModule } from '@nestjs/testing';
import { ExportCronService } from './export-cron.service';
import { ExportService } from './export.service';

describe('ExportCronService', () => {
  let cronService: ExportCronService;
  let exportService: { trgMonthlyExport: jest.Mock };

  beforeEach(async () => {
    exportService = { trgMonthlyExport: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportCronService,
        { provide: ExportService, useValue: exportService },
      ],
    }).compile();

    cronService = module.get<ExportCronService>(ExportCronService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('trigger export cho tháng trước đúng năm khi không phải tháng 1', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-15'));

    await cronService.trgMonthlyExport();

    expect(exportService.trgMonthlyExport).toHaveBeenCalledWith(6, 2026);
    jest.useRealTimers();
  });

  it('trigger export cho tháng 12 năm trước khi đang ở tháng 1', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15'));

    await cronService.trgMonthlyExport();

    expect(exportService.trgMonthlyExport).toHaveBeenCalledWith(12, 2025);
    jest.useRealTimers();
  });
});
