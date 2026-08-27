import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceResolver } from './attendance.resolver';

@Module({
  providers: [AttendanceService, AttendanceResolver],
})
export class AttendanceModule {}
