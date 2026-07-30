import { Module } from '@nestjs/common';
import { AttendanceRequestService } from './attendance-request.service';
import { AttendanceRequestResolver } from './attendance-request.resolver';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  providers: [
    AttendanceRequestService,
    AttendanceRequestResolver,
    CaslAbilityFactory,
  ],
})
export class AttendanceRequestModule {}
