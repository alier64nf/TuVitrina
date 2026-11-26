import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Profile, UserRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'tuvitrina_is_public';
export const ALLOW_UNPROFILED_KEY = 'tuvitrina_allow_unprofiled';
export const ROLES_KEY = 'tuvitrina_roles';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const AllowUnprofiled = () => SetMetadata(ALLOW_UNPROFILED_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export interface RequestAuthUser {
  uid: string;
  email: string;
  profile: Profile | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestAuthUser => {
    const req = ctx.switchToHttp().getRequest<{ authUser: RequestAuthUser }>();
    return req.authUser;
  },
);
