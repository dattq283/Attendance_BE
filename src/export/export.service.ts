import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';

@Injectable()
export class ExportService {
  constructor(@InjectQueue('export') private readonly exportQueue: Queue) {}
  async trgMonthlyExport(month: number, year: number) {
    const exportId = `EXP-${randomUUID()}`;
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
}
