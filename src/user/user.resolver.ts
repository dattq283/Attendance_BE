import { Mutation, Resolver, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { PoliciesGuard } from '../casl/policy.guard';
import { CheckPolicies } from '../casl/check-policy.decorator';
import { UserService } from './user.service';
import { User } from './user.entity';

@Resolver()
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => User)
  @CheckPolicies((ability) => ability.can('delete', 'User'))
  async softDeleteUser(@Args('userId') userId: number) {
    return this.userService.softDeleteUser(userId);
  }

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => User)
  @CheckPolicies((ability) => ability.can('update', 'User'))
  async reactiveUser(@Args('userId') userId: number) {
    return this.userService.reactiveUser(userId);
  }
}
