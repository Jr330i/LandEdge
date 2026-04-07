import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Maps Prisma failures to HTTP responses so clients do not only see a generic
 * "Internal server error" (common when the DB is behind migrations).
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(exception.message);
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid data for database operation',
      });
    }

    const code = exception.code;
    this.logger.error(`${code}: ${exception.message}`);

    if (code === 'P2022') {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          'Database schema is missing columns expected by this API. From apps/api run: npx prisma migrate deploy',
      });
    }

    if (code === 'P2002') {
      return res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        message: 'A record with this unique value already exists',
      });
    }

    if (code === 'P2003' || code === 'P2014') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Related record missing or constraint violated',
      });
    }

    if (code === 'P2025') {
      return res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Record not found',
      });
    }

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
    });
  }
}
