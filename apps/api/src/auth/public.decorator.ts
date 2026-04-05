import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip JWT auth (health, login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
