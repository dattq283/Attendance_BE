import { Module } from '@nestjs/common';
import { AttendanceRequestService } from './attendance-request.service';
import { AttendanceRequestResolver } from './attendance-request.resolver';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [AttendanceRequestService, AttendanceRequestResolver],
})
export class AttendanceRequestModule {}
