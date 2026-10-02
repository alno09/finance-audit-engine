import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { DocumentsService } from './documents.service';
import { th } from 'zod/v4/locales';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  create(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    return this.documentsService.create(file);
  }

  @Get(':id')
  findOne(
    @Param('id')
    id: string,
  ) {
    return this.documentsService.findOne(id);
  };
}
