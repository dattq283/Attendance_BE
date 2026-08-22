import { NotificationGateway } from './../notification/notification.gateway';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
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
    const { exportId, month, year } = job.data;
    try {
      await this.prisma.client.exportJob.updateMany({
        where: { exportId },
        data: { status: 'PROCESSING' },
      });
      const attendances = await this.prisma.client.attendance.findMany({
        where: {
          checkTime: {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1),
          },
        },
        orderBy: { checkTime: 'asc' },
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
      workSheet.columns = [
        { header: 'User ID', key: 'userId', width: 15 },
        { header: 'CheckTime', key: 'checkTime', width: 15 },
        { header: 'Type', key: 'type', width: 15 },
      ];
      attendances.forEach((a) => {
        workSheet.addRow({
          userId: a.userId,
          checkTime: a.checkTime.toLocaleString('vi-VN'),
          type: a.type,
        });
      });
      await workBook.xlsx.writeFile(filePath);

      await this.prisma.client.exportJob.updateMany({
        where: { exportId },
        data: { status: 'DONE', path: filePath, completedTime: new Date() },
      });
      console.log('Export completed:', { exportId, month, year, filePath });

      this.notificationGateway.notifyAdmin('exportCompleted', {
        exportId,
        month,
        year,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log('Export failed:', { exportId, month, year, error: message });
      await this.prisma.client.exportJob.updateMany({
        where: { exportId },
        data: { status: 'FAILED', reason: message, completedTime: new Date() },
      });
      this.notificationGateway.notifyAdmin('exportFailed', {
        exportId,
        month,
        year,
        reason: message,
      });
      throw error;
    }
  }
}
