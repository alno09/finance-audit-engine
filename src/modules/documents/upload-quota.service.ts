import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

// Redis time and an atomic counter keep the daily quota consistent across replicas.
const CONSUME_QUOTA = `
local limit = tonumber(ARGV[1])
local now = tonumber(redis.call('TIME')[1])
local reset = (math.floor(now / 86400) + 1) * 86400
local key = KEYS[1] .. ':' .. math.floor(now / 86400)
local count = tonumber(redis.call('GET', key) or '0')
if count >= limit then
  return {0, 0, reset - now}
end
count = redis.call('INCR', key)
redis.call('EXPIREAT', key, reset)
return {1, limit - count, reset - now}
`;

@Injectable()
export class UploadQuotaService implements OnModuleDestroy {
  readonly dailyLimit = this.parseDailyLimit();

  private readonly redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
  });

  private connecting?: Promise<void>;

  constructor() {
    // Connection failures are handled by the guard with a closed upload gate.
    this.redis.on('error', () => undefined);
  }

  async consume(identity: string) {
    await this.ensureConnected();

    const result = (await this.redis.eval(
      CONSUME_QUOTA,
      1,
      `upload-quota:${identity}`,
      this.dailyLimit,
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfter: result[2],
      resetAt: new Date(Date.now() + result[2] * 1000),
      limit: this.dailyLimit,
    };
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  private async ensureConnected() {
    if (this.redis.status === 'ready') {
      return;
    }

    this.connecting ??= this.redis.connect().finally(() => {
      this.connecting = undefined;
    });

    await this.connecting;
  }

  private parseDailyLimit() {
    const limit = Number(process.env.UPLOAD_DAILY_LIMIT ?? 2);

    if (!Number.isInteger(limit) || limit < 1) {
      return 2;
    }

    return limit;
  }
}
