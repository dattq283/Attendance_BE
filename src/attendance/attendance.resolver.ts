import { Args, Mutation, Resolver, Query } from '@nestjs/graphql';
import { Attendance } from './attendance.entity';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AttendanceService } from './attendance.service';
import { CheckPolicies } from '../casl/check-policy.decorator';
import { PoliciesGuard } from '../casl/policy.guard';

@Resolver()
export class AttendanceResolver {
  constructor(private attendanceService: AttendanceService) {}
  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => Attendance)
  checkIn(@CurrentUser('userId') userId: number) {
    return this.attendanceService.checkIn(userId);
  }
  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Query(() => [Attendance])
  @CheckPolicies((ability) => ability.can('read', 'Attendance'))
  showHistory(
    @CurrentUser() user: { userId: number; role: string },
    @Args('from', { nullable: true }) from?: Date,
    @Args('to', { nullable: true }) to?: Date,
  ) {
    return this.attendanceService.showHistory(user, from, to);
  }
}
