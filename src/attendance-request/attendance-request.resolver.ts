import { Mutation, Resolver, Args, Query } from '@nestjs/graphql';
import { AttendanceRequestService } from './attendance-request.service';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { AttendanceRequest } from './attendance-request.entity';
import { AttendanceRequestInput } from './attendance-request.input';
import { CurrentUser } from '../auth/current-user.decorator';
import { PoliciesGuard } from '../casl/policy.guard';
import { CheckPolicies } from '../casl/check-policy.decorator';
import { RequestStatus } from '@prisma/client';

@Resolver()
export class AttendanceRequestResolver {
  constructor(private attendanceRequestService: AttendanceRequestService) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => AttendanceRequest)
  createRequest(
    @CurrentUser('userId') userId: number,
    @Args('input') input: AttendanceRequestInput,
  ) {
    return this.attendanceRequestService.createRequest(userId, input);
  }

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Query(() => [AttendanceRequest])
  @CheckPolicies((ability) => ability.can('read', 'AttendanceRequest'))
  showRequestList(
    @CurrentUser() user: { userId: number; role: string },
    @Args('status', { type: () => RequestStatus, nullable: true })
    status?: RequestStatus,
  ) {
    return this.attendanceRequestService.showRequestList(user, status);
  }

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => AttendanceRequest)
  @CheckPolicies((ability) => ability.can('update', 'AttendanceRequest'))
  approveRequest(
    @CurrentUser() user: { userId: number; role: string },
    @Args('requestId') requestId: number,
  ) {
    return this.attendanceRequestService.approveRequest(requestId, user);
  }

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => AttendanceRequest)
  @CheckPolicies((ability) => ability.can('update', 'AttendanceRequest'))
  rejectRequest(
    @CurrentUser() user: { userId: number; role: string },
    @Args('requestId') requestId: number,
    @Args('note', { nullable: true }) note?: string,
  ) {
    return this.attendanceRequestService.rejectRequest(requestId, user, note);
  }
}
