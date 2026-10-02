import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    DocumentsModule,
    OutboxModule,
    StorageModule,
    ExtractionModule,
    AiModule,
    InvoicesModule,
    AuditModule,
  ]
})
export class AppModule {}