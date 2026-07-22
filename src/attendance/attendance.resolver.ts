import { Mutation, Resolver } from '@nestjs/graphql';
import { Attendance } from './attendance.entity';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AttendanceService } from './attendance.service';

@Resolver()
export class AttendanceResolver {
  constructor(private attendanceService: AttendanceService) {}
  @UseGuards(GqlAuthGuard)
  @Mutation(() => Attendance)
  checkIn(@CurrentUser('userId') userId: number) {
    return this.attendanceService.checkIn(userId);
  }
}
