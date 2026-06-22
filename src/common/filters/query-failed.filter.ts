import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * Maps raw Postgres/TypeORM errors that would otherwise surface as opaque 500s
 * into the correct client status. Only catches QueryFailedError — every other
 * exception (HttpExceptions thrown by services, validation, etc.) flows through
 * Nest's default handling unchanged.
 *
 * Notably fixes "non-UUID id → 22P02 → 500" across every `/:id` route.
 */
@Catch(QueryFailedError)
export class QueryFailedExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(QueryFailedExceptionFilter.name);

  catch(exception: QueryFailedError & { code?: string }, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const code = exception.code;

    // 22P02 invalid_text_representation — e.g. a non-uuid where a uuid is expected.
    if (code === '22P02') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid identifier or value format',
      });
    }

    // 23505 unique_violation — services usually map these to 409 already; this
    // is a defensive net so a stray unique clash is a 409, not a 500.
    if (code === '23505') {
      return res.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Resource already exists',
      });
    }

    // 23503 foreign_key_violation — referenced row missing / still referenced.
    if (code === '23503') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Related resource does not exist or is still in use',
      });
    }

    // Anything else really is a server error — log the detail, return generic.
    this.logger.error(`Unhandled DB error (${code}): ${exception.message}`);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  }
}
