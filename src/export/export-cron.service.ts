import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ExportService } from './export.service';
import { businessTime } from '../utils/date.util';
@Injectable()
export class ExportCronService {
  constructor(private readonly exportService: ExportService) {}
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async trgMonthlyExport() {
    const { year, month } = businessTime(new Date());
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    console.log(`Start export ${prevMonth}/${prevYear}`);
    await this.exportService.trgMonthlyExport(prevMonth, prevYear);
  }
}
