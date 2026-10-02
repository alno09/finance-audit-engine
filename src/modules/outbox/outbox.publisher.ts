import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import {
  DOCUMENT_QUEUE,
} from '../documents/documents.constants';

@Injectable()
export class OutboxPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger =
    new Logger(OutboxPublisher.name);

  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,

    @InjectQueue(DOCUMENT_QUEUE)
    private readonly documentQueue: Queue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(
      () => {
        void this.publishPendingEvents();
      },
      3000,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async publishPendingEvents() {
    const events =
      await this.prisma.outboxEvent.findMany({
        where: {
          status: 'PENDING',
        },

        orderBy: {
          createdAt: 'asc',
        },

        take: 10,
      });

    for (const event of events) {
      try {
        await this.documentQueue.add(
          event.type,
          event.payload as {
            documentId: string;
          },
          {
            jobId: event.id,
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: false,
            removeOnFail: false
          },
        );

        await this.prisma.outboxEvent.update({
          where: {
            id: event.id,
          },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });

        await this.prisma.document.update({
          where: {
            id: event.aggregateId,
          },
          data: {
            status: 'QUEUED',
          },
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown error';

        this.logger.error(
          `Failed publishing outbox event ${event.id}: ${message}`,
        );

        await this.prisma.outboxEvent.update({
          where: {
            id: event.id,
          },
          data: {
            attempts: {
              increment: 1,
            },
            lastError: message,
          },
        });
      }
    }
  }
}