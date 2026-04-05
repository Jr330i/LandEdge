import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtAccessPayload } from './jwt.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAccessPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: JwtAccessPayload }>();
    return req.user;
  },
);
