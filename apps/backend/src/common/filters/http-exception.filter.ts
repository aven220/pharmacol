import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as Record<string, unknown>;
        message = (obj.message as string) ?? message;
        if (Array.isArray(message)) {
          message = message.join(', ');
        }
        code = (obj.error as string) ?? code;
      }
      if (message.includes('serialize a BigInt')) {
        message = 'Error al procesar datos (BigInt). Contacte al administrador.';
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      message =
        exception.message.includes('serialize a BigInt')
          ? 'Error al procesar datos del servidor'
          : exception.message;
    }

    if (status === HttpStatus.UNAUTHORIZED) {
      code = 'UNAUTHORIZED';
      if (message === 'Unauthorized') message = 'No autorizado — inicia sesión de nuevo';
    } else if (status === HttpStatus.NOT_FOUND) {
      code = 'NOT_FOUND';
    } else if (status === HttpStatus.BAD_REQUEST) {
      code = 'BAD_REQUEST';
    }

    response.status(status).json({
      success: false,
      error: message,
      code,
      statusCode: status,
    });
  }
}
