import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceResolver } from './attendance.resolver';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

@Module({
  providers: [AttendanceService, AttendanceResolver, CaslAbilityFactory],
})
export class AttendanceModule {}
