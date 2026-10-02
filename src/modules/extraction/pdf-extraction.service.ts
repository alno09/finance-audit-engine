import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

@Injectable()
export class PdfExtractionService {
  async extractText(
    buffer: Buffer,
  ): Promise<string> {
    const parser = new PDFParse({
      data: buffer,
    });

    try {
      const result =
        await parser.getText();

      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }
}