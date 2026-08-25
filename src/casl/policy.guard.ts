import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './check-policy.decorator';

interface RequestUser {
  userId: number;
  username: string;
  role: string;
}

interface GraphQLContext {
  req: Request & { user: RequestUser };
}

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policyHandlers = this.reflector.getAllAndOverride<PolicyHandler[]>(
      CHECK_POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Neu khong co policy nao khai bao, mac dinh tu choi
    if (!policyHandlers || policyHandlers.length === 0) {
      console.log(
        `No policies declared for ${context.getClass().name}.${context.getHandler().name}!`,
      );
      return false;
    }
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext<GraphQLContext>().req;
    const user = request.user;
    if (!user) {
      console.log('No user found on request!');
      return false;
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    return policyHandlers.every((handler) => handler(ability));
  }
}
