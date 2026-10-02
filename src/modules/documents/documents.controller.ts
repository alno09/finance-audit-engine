import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { DocumentsService } from './documents.service';
import { UploadQuotaGuard } from './upload-quota.guard';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(UploadQuotaGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
        files: 1,
        fields: 0,
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
  }
}
