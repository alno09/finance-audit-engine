import { Global, Module } from '@nestjs/common';
import { PdfExtractionService } from './pdf-extraction.service';

@Global()
@Module({
  providers: [PdfExtractionService, PdfExtractionService],
  exports: [PdfExtractionService],
})
export class ExtractionModule {}
