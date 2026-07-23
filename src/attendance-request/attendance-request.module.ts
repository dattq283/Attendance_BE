import { Module } from '@nestjs/common';
import { AttendanceRequestService } from './attendance-request.service';
import { AttendanceRequestResolver } from './attendance-request.resolver';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';

@Module({
  providers: [
    AttendanceRequestService,
    AttendanceRequestResolver,
    CaslAbilityFactory,
  ],
})
export class AttendanceRequestModule {}
