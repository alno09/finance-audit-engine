import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import {
  DOCUMENT_QUEUE,
} from '../documents/documents.constants';

import { OutboxPublisher } from './outbox.publisher';

@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_QUEUE,
    }),
  ],

  providers: [
    OutboxPublisher,
  ],
})
export class OutboxModule {}