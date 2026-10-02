import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import { InvoiceAiProvider } from './invoice-ai.provider';

import {
  InvoiceExtraction,
  invoiceExtractionSchema,
} from '../../modules/extraction/schemas/invoice.schema';

@Injectable()
export class OpenAiInvoiceProvider
  implements InvoiceAiProvider
{
  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async extractInvoice(
    rawText: string,
  ): Promise<InvoiceExtraction> {
    const response =
      await this.client.responses.create({
        model: 'gpt-5.6-mini',

        input: [
          {
            role: 'system',
            content:
              'Extract structured invoice data from raw text. Return JSON only. Do not invent missing values. Use null when a value is unavailable.',
          },
          {
            role: 'user',
            content: rawText,
          },
        ],
      });

    const rawOutput = response.output_text;

    let parsed: unknown;

    try {
      parsed = JSON.parse(rawOutput);
    } catch {
      throw new Error(
        'AI returned invalid JSON',
      );
    }

    return invoiceExtractionSchema.parse(
      parsed,
    );
  }
}