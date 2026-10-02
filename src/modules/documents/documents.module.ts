import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { DOCUMENT_QUEUE } from './documents.constants';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentProcessor } from './document.processor';
import { UploadQuotaGuard } from './upload-quota.guard';
import { UploadQuotaService } from './upload-quota.service';
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
    UploadQuotaGuard,
    UploadQuotaService,
  ],
})
export class DocumentsModule {}
