import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createHash, randomUUID } from 'node:crypto';
import { DocumentsController } from '../src/modules/documents/documents.controller';
import { DocumentsService } from '../src/modules/documents/documents.service';
import { UploadQuotaGuard } from '../src/modules/documents/upload-quota.guard';
import { UploadQuotaService } from '../src/modules/documents/upload-quota.service';

jest.mock('../src/modules/documents/documents.service', () => ({
  DocumentsService: class DocumentsService {},
}));

// Run against a dedicated temporary Redis, never the application's Redis.
const integration = process.env.TEST_REDIS_PORT ? describe : describe.skip;

integration('Daily upload quota (Redis + HTTP)', () => {
  let app: INestApplication<App>;
  let quota: UploadQuotaService;
  let redis: Redis;
  const create = jest.fn().mockResolvedValue({ id: 'demo-document' });
  const oldHost = process.env.REDIS_HOST;
  const oldPort = process.env.REDIS_PORT;

  beforeAll(async () => {
    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = process.env.TEST_REDIS_PORT;
    redis = new Redis({
      host: '127.0.0.1',
      port: Number(process.env.TEST_REDIS_PORT),
    });
    for (const ip of ['127.0.0.1', '::1']) {
      const identity = createHash('sha256').update(ip).digest('hex');
      const keys = await redis.keys(`upload-quota:${identity}:*`);
      if (keys.length) await redis.del(...keys);
    }
    const module = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        UploadQuotaService,
        UploadQuotaGuard,
        { provide: DocumentsService, useValue: { create, findOne: jest.fn() } },
      ],
    }).compile();
    quota = module.get(UploadQuotaService);
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    redis?.disconnect();
    if (oldHost === undefined) delete process.env.REDIS_HOST;
    else process.env.REDIS_HOST = oldHost;
    if (oldPort === undefined) delete process.env.REDIS_PORT;
    else process.env.REDIS_PORT = oldPort;
  });

  it('allows exactly two concurrent attempts and expires at UTC midnight', async () => {
    const identity = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 12 }, () => quota.consume(identity)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(2);
    const [key] = await redis.keys(`upload-quota:${identity}:*`);
    expect(await redis.get(key)).toBe('2');
    const ttl = await redis.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86400);
    const [seconds] = await redis.time();
    expect(
      Math.abs(ttl - (86400 - (Number(seconds) % 86400))),
    ).toBeLessThanOrEqual(1);
    const anotherInstance = new UploadQuotaService();
    try {
      expect(await anotherInstance.consume(identity)).toMatchObject({
        allowed: false,
        remaining: 0,
      });
    } finally {
      anotherInstance.onModuleDestroy();
    }
    expect(await quota.consume(randomUUID())).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    // Expiration is what lets the next window start with a fresh quota.
    await redis.expire(key, 0);
    expect(await quota.consume(identity)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it('blocks the third upload before multipart processing, ignoring forged IP headers', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/documents')
      .set('X-Forwarded-For', '198.51.100.1')
      .attach('file', Buffer.from('%PDF-1.4 demo'), 'demo.pdf')
      .expect(201)
      .expect('X-Upload-Remaining', '1');
    await request(server)
      .post('/documents')
      .set('X-Forwarded-For', '198.51.100.2')
      .attach('file', Buffer.from('%PDF-1.4 demo'), 'demo.pdf')
      .expect(201)
      .expect('X-Upload-Remaining', '0');
    const rejected = await request(server)
      .post('/documents')
      .set('X-Forwarded-For', '198.51.100.3')
      .attach('unexpected-field', Buffer.from('invalid'), 'demo.pdf')
      .expect(429);
    expect(Number(rejected.headers['retry-after'])).toBeGreaterThan(0);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('keeps document reads available when upload quota is exhausted', async () => {
    await request(app.getHttpServer())
      .get('/documents/demo-document')
      .expect(200);
  });

  it('blocks uploads if Redis fails instead of allowing unlimited attempts', async () => {
    const consume = jest
      .spyOn(quota, 'consume')
      .mockRejectedValueOnce(new Error('Redis unavailable'));
    await request(app.getHttpServer()).post('/documents').expect(503);
    expect(create).toHaveBeenCalledTimes(2);
    consume.mockRestore();
  });
});
