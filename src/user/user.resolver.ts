import { Mutation, Resolver, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PoliciesGuard } from '../casl/policy.guard';
import { CheckPolicies } from '../casl/check-policy.decorator';
import { UserService } from './user.service';
import { User } from './user.entity';
import { CurrentUser } from '../auth/current-user.decorator';

@Resolver()
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => User)
  @CheckPolicies((ability) => ability.can('delete', 'User'))
  async softDeleteUser(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser: { userId: number; role: string },
  ) {
    return this.userService.softDeleteUser(userId, currentUser.userId);
  }

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => User)
  @CheckPolicies((ability) => ability.can('update', 'User'))
  async reactiveUser(@Args('userId', { type: () => Int }) userId: number) {
    return this.userService.reactiveUser(userId);
  }
}
