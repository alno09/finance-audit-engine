import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/infrastructure/database/prisma.service';
import { DOCUMENT_JOBS } from './documents.constants';
import { createHash } from 'crypto';
import { StorageService } from 'src/infrastructure/storage/storage.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Document file is required');
    }

    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported document type');
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    const existingDocument = await this.prisma.document.findUnique({
      where: {
        sha256,
      },
    });

    if (existingDocument) {
      // throw new ConflictException('Document already exists');
      return existingDocument;
    }

    let storageKey: string | undefined

    try {
    storageKey =
      await this.storage.save(file);

    const document = await this.prisma.$transaction(async (tx) => {
      const createdDocument = await tx.document.create({
        data: {
          filename: file.originalname,
          mimeType: file.mimetype,
          sha256,
          storageKey,
          status: 'UPLOADED',
        },
      });

      await tx.outboxEvent.create({
        data: {
          type: DOCUMENT_JOBS.PROCESS,

          aggregateId: createdDocument.id,

          payload: {
            documentId: createdDocument.id,
          },
        },
      });

      return createdDocument;
    });

    return document;
    } catch (error) {
      if (storageKey) {
        await this.storage
          .delete(storageKey)
          .catch(() => undefined);
      }

      throw error;
    }
  }

  async findOne(
    documentId: string,
  ) {
    const document =
      await this.prisma.document.findUnique({
        where: {
          id: documentId,
        },

        include: {
          extraction: true,

          invoice: {
            include: {
              lineItems: true,

              audit: {
                include: {
                  findings: true,
                }
              }
            }
          }
        }
      });

      if (!document) {
        throw new NotFoundException(
          `Document ${documentId} not found`,
        );
      }

      return document;
  }
}
