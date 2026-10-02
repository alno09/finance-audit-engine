import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { UploadQuotaService } from './upload-quota.service';

@Injectable()
export class UploadQuotaGuard implements CanActivate {
  constructor(private readonly quota: UploadQuotaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const ip = request.ip ?? request.socket.remoteAddress;
    if (!ip) {
      throw new ServiceUnavailableException('Cannot identify upload client');
    }

    const identity = createHash('sha256')
      .update(ip.replace(/^::ffff:/i, '').toLowerCase())
      .digest('hex');

    let quota: Awaited<ReturnType<UploadQuotaService['consume']>>;
    try {
      quota = await this.quota.consume(identity);
    } catch {
      throw new ServiceUnavailableException(
        'Upload quota is temporarily unavailable. Please try again later.',
      );
    }

    response.setHeader('X-Upload-Limit', String(quota.limit));
    response.setHeader('X-Upload-Remaining', String(quota.remaining));
    response.setHeader(
      'X-Upload-Reset',
      String(Math.ceil(quota.resetAt.getTime() / 1000)),
    );
    if (!quota.allowed) {
      response.setHeader('Retry-After', String(quota.retryAfter));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Daily upload limit reached (${quota.limit} attempts per IP).`,
          retryAfter: quota.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
