import { InvoiceExtraction } from '../../modules/extraction/schemas/invoice.schema';

export abstract class InvoiceAiProvider {
  abstract extractInvoice(
    rawText: string,
  ): Promise<InvoiceExtraction>;
}