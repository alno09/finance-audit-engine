import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { DOCUMENT_QUEUE } from './documents.constants';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentProcessor } from './document.processor';
@Module({
  imports: [
    BullModule.registerQueue({
      name: DOCUMENT_QUEUE,
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentProcessor,
  ],
})
export class DocumentsModule {}