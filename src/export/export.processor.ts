import { NotificationGateway } from './../notification/notification.gateway';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { monthStart, nextMonthStart, dateKey } from '../utils/date.util';
interface MonthlyReportData {
  exportId: string;
  month: number;
  year: number;
}
@Processor('export')
export class ExportProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
  ) {
    super();
  }
  async process(job: Job<MonthlyReportData>): Promise<void> {
    if (job.name !== 'generateMonthlyReport') {
      throw new Error(`Unknown job name: ${job.name}`);
    }
    const { exportId, month, year } = job.data;
    try {
      await this.prisma.client.exportJob.updateMany({
        where: { exportId },
        data: { status: 'PROCESSING' },
      });
      const attendances = await this.prisma.client.attendance.findMany({
        where: {
          checkTime: {
            gte: monthStart(year, month),
            lt: nextMonthStart(year, month),
          },
        },
        orderBy: { checkTime: 'asc' },
        include: { user: { select: { fullName: true } } },
      });
      const folderPath = path.join(
        process.cwd(),
        'exports',
        `${month}-${year}`,
      );
      fs.mkdirSync(folderPath, { recursive: true });

      const filePath = path.join(folderPath, `${exportId}.xlsx`);

      const workBook = new ExcelJS.Workbook();
      const workSheet = workBook.addWorksheet('Attendance Report');
      const rows = new Map<
        string,
        { userId: number; fullName: string; day: string; count: number }
      >();
      attendances.forEach((a) => {
        const key = `${a.userId}|${dateKey(a.checkTime)}`;
        const cur = rows.get(key);
        if (cur) cur.count += 1;
        else
          rows.set(key, {
            userId: a.userId,
            fullName: a.user.fullName,
            day: dateKey(a.checkTime),
            count: 1,
          });
      });

      workSheet.columns = [
        { header: 'User ID', key: 'userId', width: 12 },
        { header: 'Full Name', key: 'fullName', width: 20 },
        { header: 'Date', key: 'day', width: 12 },
        { header: 'Check-in Count', key: 'count', width: 15 },
      ];
      rows.forEach((r) => workSheet.addRow(r));
      await workBook.xlsx.writeFile(filePath);

      const updatedJob = await this.prisma.client.exportJob.update({
        where: { exportId },
        data: {
          status: 'DONE',
          path: `/exports/${month}-${year}/${exportId}.xlsx`,
          completedTime: new Date(),
        },
      });
      console.log('Export completed:', {
        exportId,
        month,
        year,
        filePath: `/exports/${month}-${year}/${exportId}.xlsx`,
      });
      if (updatedJob.exportedBy) {
        this.notificationGateway.notifyUser(
          updatedJob.exportedBy,
          'exportCompleted',
          {
            exportId,
            month,
            year,
            message: `${month}/${year} report is ready!`,
            path: `/exports/${month}-${year}/${exportId}.xlsx`,
          },
        );
      } else {
        this.notificationGateway.notifyAdmin('exportCompleted', {
          exportId,
          month,
          year,
          message: `${month}/${year} report is ready!`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (!isLastAttempt) {
        console.log(
          `Export attempt ${job.attemptsMade + 1} failed. Trying again...`,
          {
            exportId,
            month,
            year,
            error: message,
          },
        );
        throw error;
      }
      try {
        const updatedJob = await this.prisma.client.exportJob.update({
          where: { exportId },
          data: {
            status: 'FAILED',
            reason: message,
            completedTime: new Date(),
          },
        });
        if (updatedJob.exportedBy) {
          this.notificationGateway.notifyUser(
            updatedJob.exportedBy,
            'exportFailed',
            {
              exportId,
              month,
              year,
              reason: message,
            },
          );
        } else {
          this.notificationGateway.notifyAdmin('exportFailed', {
            exportId,
            month,
            year,
            reason: message,
          });
        }
      } catch {
        console.log('Failed to export record');
      }
      throw error;
    }
  }
}
