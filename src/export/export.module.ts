import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ExportService } from './export.service';
import { ExportResolver } from './export.resolver';
import { ExportProcessor } from './export.processor';
import { ExportCronService } from './export-cron.service';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
@Module({
  imports: [
    BullModule.registerQueue({ name: 'export' }),
    NotificationModule,
    PrismaModule,
  ],
  providers: [
    ExportService,
    ExportResolver,
    ExportProcessor,
    ExportCronService,
    CaslAbilityFactory,
  ],
})
export class ExportModule {}
