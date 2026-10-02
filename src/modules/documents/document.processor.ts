import { Logger } from '@nestjs/common';

import {
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import {
  Job,
  UnrecoverableError,
} from 'bullmq';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { InvoiceAiProvider } from '../../infrastructure/ai/invoice-ai.provider';

import {
  PermanentProcessingError,
} from '../../common/errors/processing.errors';

import {
  DOCUMENT_JOBS,
  DOCUMENT_QUEUE,
} from '../documents/documents.constants';

import { PdfExtractionService } from '../extraction/pdf-extraction.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AuditService } from '../audit/audit.service';

type ProcessDocumentJob = {
  documentId: string;
};

@Processor(DOCUMENT_QUEUE)
export class DocumentProcessor extends WorkerHost {
  private readonly logger =
    new Logger(DocumentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly pdfExtraction: PdfExtractionService,
    private readonly invoiceAi: InvoiceAiProvider,
    private readonly invoicesService: InvoicesService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async process(
    job: Job<ProcessDocumentJob>,
  ): Promise<void> {
    switch (job.name) {
      case DOCUMENT_JOBS.PROCESS:
        await this.processDocument(job);
        return;

      default:
        throw new Error(
          `Unknown job: ${job.name}`,
        );
    }
  }

  private async processDocument(
    job: Job<ProcessDocumentJob>,
  ): Promise<void> {
    const { documentId } = job.data;

    const document =
      await this.prisma.document.findUnique({
        where: {
          id: documentId,
        },
      });

    if (!document) {
      throw new Error(
        `Document ${documentId} not found`,
      );
    }

    if (
      document.status === 'APPROVED' ||
      document.status === 'NEEDS_REVIEW'
    ) {
      this.logger.log(
        `Document ${documentId} already completed. Skipping.`,
      );

      return;
    }

    if (!document.storageKey) {
      throw new Error(
        `Document ${documentId} has no storage key`,
      );
    }

    this.logger.log(
      `Processing document ${documentId}. Attempt ${
        job.attemptsMade + 1
      }`,
    );

    try {
      await this.prisma.document.update({
        where: {
          id: documentId,
        },

        data: {
          status: 'EXTRACTING',
          errorMessage: null,
        },
      });

      const fileBuffer =
        await this.storage.read(
          document.storageKey,
        );

      this.logger.log(
        `Loaded ${fileBuffer.length} bytes for document ${documentId}`,
      );

      const extractedText =
        await this.pdfExtraction.extractText(
          fileBuffer,
        );

      this.logger.log(
        `Extracted ${extractedText.length} characters`,
      );

      await this.prisma.extraction.upsert({
        where: {
          documentId,
        },

        create: {
          documentId,
          method: 'PDF_TEXT',
          rawText: extractedText,
          characterCount:
            extractedText.length,
        },

        update: {
          method: 'PDF_TEXT',
          rawText: extractedText,
          characterCount:
            extractedText.length,
        },
      });

      const structuredInvoice =
        await this.invoiceAi.extractInvoice(
          extractedText,
        );

      const invoice =
        await this.invoicesService
          .saveFromExtraction(
            documentId,
            structuredInvoice,
          );

      await this.prisma.document.update({
        where: {
          id: documentId,
        },

        data: {
          status: 'AUDITING',
        },
      });

      const auditResult =
        await this.auditService.auditInvoice(
          invoice.id,
        );

      await this.prisma.document.update({
        where: {
          id: documentId,
        },

        data: {
          status:
            auditResult.audit.status ===
            'PASSED'
              ? 'APPROVED'
              : 'NEEDS_REVIEW',

          errorMessage: null,
        },
      });

      this.logger.log(
        `Document ${documentId} completed with status ${auditResult.audit.status}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown processing error';

      await this.prisma.document.update({
        where: {
          id: documentId,
        },

        data: {
          errorMessage: message,
        },
      });

      this.logger.warn(
        `Document ${documentId} failed on attempt ${
          job.attemptsMade + 1
        }: ${message}`,
      );

      if (
        error instanceof
          PermanentProcessingError
      ) {
        this.logger.error(
          `Permanent failure for document ${documentId}. Retry aborted.`,
        );

        throw new UnrecoverableError(
          message,
        );
      }

      throw error;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(
    job:
      | Job<ProcessDocumentJob>
      | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    const maxAttempts =
      job.opts.attempts ?? 1;

    const isUnrecoverable =
      error.name ===
      'UnrecoverableError';

    const finalAttempt =
      job.attemptsMade >= maxAttempts;

    if (
      !finalAttempt &&
      !isUnrecoverable
    ) {
      this.logger.warn(
        `Document ${
          job.data.documentId
        } will retry. Attempts: ${
          job.attemptsMade
        }/${maxAttempts}`,
      );

      return;
    }

    const { documentId } = job.data;

    await this.prisma.document.update({
      where: {
        id: documentId,
      },

      data: {
        status: 'EXTRACTION_FAILED',
        errorMessage: error.message,
      },
    });

    this.logger.error(
      `Document ${documentId} permanently failed: ${error.message}`,
    );
  }
}