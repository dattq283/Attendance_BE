import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExportService } from './export.service';

@Injectable()
export class ExportCronService {
  constructor(private readonly exportService: ExportService) {}
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async trgMonthlyExport() {
    const now = new Date();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const year =
      now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    console.log(`Start export ${month}/${year}`);
    await this.exportService.trgMonthlyExport(month, year);
  }
}
