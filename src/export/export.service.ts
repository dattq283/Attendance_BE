import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(
    @InjectQueue('export') private readonly exportQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}
  async trgMonthlyExport(
    month: number,
    year: number,
    exportedBy?: number,
  ): Promise<string> {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`Invalid month!`);
    }
    if (!Number.isInteger(year) || year < 1) {
      throw new Error(`Invalid year!`);
    }
    const exportId = `EXP-${randomUUID()}`;
    await this.prisma.client.exportJob.create({
      data: {
        exportId,
        exportMonth: month,
        exportYear: year,
        exportedBy,
        status: 'QUEUED',
      },
    });

    const job = await this.exportQueue.add(
      'generateMonthlyReport',
      { exportId, month, year },
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 5000 },
      },
    );
    if (!job.id) {
      throw new Error('Job ID was not created');
    }

    return exportId;
  }
  async getExportReport(exportId: string) {
    return await this.prisma.client.exportJob.findFirst({
      where: {
        exportId,
      },
    });
  }
}
