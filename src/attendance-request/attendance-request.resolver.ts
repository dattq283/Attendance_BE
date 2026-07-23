import { Mutation, Resolver, Args } from '@nestjs/graphql';
import { AttendanceRequestService } from './attendance-request.service';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { AttendanceRequest } from './attendance-request.entity';
import { AttendanceRequestInput } from './attendance-request.input';
import { CurrentUser } from '../auth/current-user.decorator';

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
}
