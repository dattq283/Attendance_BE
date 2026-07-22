import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { User } from '@prisma/client';
import { Request } from 'express';
interface GraphQLContext {
  req: Request & { user?: User };
}
export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const context = GqlExecutionContext.create(ctx);
    const request = context.getContext<GraphQLContext>().req;
    const user = request.user;
    const key = data as keyof User;
    return data ? user?.[key] : user;
  },
);
