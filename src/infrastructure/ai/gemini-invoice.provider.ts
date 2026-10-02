import { Injectable } from '@nestjs/common';

import {
  GoogleGenAI,
  Type,
} from '@google/genai';

import { InvoiceAiProvider } from './invoice-ai.provider';

import {
  InvoiceExtraction,
  invoiceExtractionSchema,
} from '../../modules/extraction/schemas/invoice.schema';

import {
  PermanentProcessingError,
  RetryableProcessingError,
} from '../../common/errors/processing.errors';

@Injectable()
export class GeminiInvoiceProvider
  implements InvoiceAiProvider
{
  private readonly client: GoogleGenAI;

  constructor() {
    this.client = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  async extractInvoice(
    rawText: string,
  ): Promise<InvoiceExtraction> {
    try {
      const response =
        await this.client.models.generateContent({
          model:
            'gemini-3.5-flash-lite',

          contents: `
Extract structured financial data from the invoice text below.

Rules:
- Do not invent missing information.
- Use null when information is unavailable.
- Monetary values must be plain numbers.
- Extract all line items that can be identified reliably.
- Preserve the invoice currency when identifiable.
- Dates should use YYYY-MM-DD when possible.

Raw invoice text:

${rawText}
          `,

          config: {
            responseMimeType:
              'application/json',

            responseSchema: {
              type: Type.OBJECT,

              properties: {
                invoiceNumber: {
                  type: Type.STRING,
                  nullable: true,
                },

                vendorName: {
                  type: Type.STRING,
                  nullable: true,
                },

                customerName: {
                  type: Type.STRING,
                  nullable: true,
                },

                invoiceDate: {
                  type: Type.STRING,
                  nullable: true,
                },

                dueDate: {
                  type: Type.STRING,
                  nullable: true,
                },

                currency: {
                  type: Type.STRING,
                },

                subtotal: {
                  type: Type.NUMBER,
                  nullable: true,
                },

                tax: {
                  type: Type.NUMBER,
                  nullable: true,
                },

                total: {
                  type: Type.NUMBER,
                  nullable: true,
                },

                items: {
                  type: Type.ARRAY,

                  items: {
                    type: Type.OBJECT,

                    properties: {
                      description: {
                        type: Type.STRING,
                      },

                      quantity: {
                        type: Type.NUMBER,
                        nullable: true,
                      },

                      unitPrice: {
                        type: Type.NUMBER,
                        nullable: true,
                      },

                      total: {
                        type: Type.NUMBER,
                        nullable: true,
                      },
                    },

                    required: [
                      'description',
                      'quantity',
                      'unitPrice',
                      'total',
                    ],
                  },
                },
              },

              required: [
                'invoiceNumber',
                'vendorName',
                'customerName',
                'invoiceDate',
                'dueDate',
                'currency',
                'subtotal',
                'tax',
                'total',
                'items',
              ],
            },
          },
        });

      if (!response.text) {
        throw new RetryableProcessingError(
          'Gemini returned an empty response',
        );
      }

      let parsed: unknown;

      try {
        parsed =
          JSON.parse(response.text);
      } catch (error) {
        throw new PermanentProcessingError(
          'Gemini returned invalid JSON',
          error,
        );
      }

      const validation =
        invoiceExtractionSchema.safeParse(
          parsed,
        );

      if (!validation.success) {
        throw new PermanentProcessingError(
          `Gemini response failed schema validation: ${validation.error.message}`,
          validation.error,
        );
      }

      return validation.data;
    } catch (error) {
      if (
        error instanceof
          RetryableProcessingError ||
        error instanceof
          PermanentProcessingError
      ) {
        throw error;
      }

      throw this.classifyGeminiError(
        error,
      );
    }
  }

  private classifyGeminiError(
    error: unknown,
  ): Error {
    const statusCode =
      this.getStatusCode(error);

    if (
      statusCode === 408 ||
      statusCode === 429 ||
      (
        statusCode !== null &&
        statusCode >= 500
      )
    ) {
      return new RetryableProcessingError(
        `Temporary Gemini failure (${statusCode ?? 'unknown'})`,
        error,
      );
    }

    if (
      statusCode === 400 ||
      statusCode === 401 ||
      statusCode === 403 ||
      statusCode === 404
    ) {
      return new PermanentProcessingError(
        `Permanent Gemini failure (${statusCode})`,
        error,
      );
    }

    return new RetryableProcessingError(
      'Unknown Gemini provider failure',
      error,
    );
  }

  private getStatusCode(
    error: unknown,
  ): number | null {
    if (
      typeof error !== 'object' ||
      error === null
    ) {
      return null;
    }

    const candidate =
      error as {
        status?: unknown;
        code?: unknown;
      };

    if (
      typeof candidate.status ===
      'number'
    ) {
      return candidate.status;
    }

    if (
      typeof candidate.code ===
      'number'
    ) {
      return candidate.code;
    }

    return null;
  }
}