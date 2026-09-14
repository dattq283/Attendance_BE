import { AuthResponse } from './auth-response.entity';
import { AuthService } from './auth.service';
import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';
import { CreateUserInput } from './dto/create-user.input';
import { LoginInput } from './dto/login.input';
import { User } from '../user/user.entity';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from './gql-auth.guard';
import { PoliciesGuard } from '../casl/policy.guard';
import { CheckPolicies } from '../casl/check-policy.decorator';
import { Request } from 'express';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async login(
    @Args('input') input: LoginInput,
    @Context() ctx: { req: Request },
  ): Promise<AuthResponse> {
    const ip = ctx.req.ip || 'unknown';
    return this.authService.login(input, ip);
  }

  @UseGuards(GqlAuthGuard, PoliciesGuard)
  @Mutation(() => User)
  @CheckPolicies((ability) => ability.can('create', 'User'))
  async createUser(@Args('input') input: CreateUserInput) {
    return await this.authService.createUser(input);
  }
}
