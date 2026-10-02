import { z } from 'zod';

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1),

  quantity: z.number().nullable(),

  unitPrice: z.number().nullable(),

  total: z.number().nullable(),
});

export const invoiceExtractionSchema = z.object({
  invoiceNumber: z.string().nullable(),

  vendorName: z.string().nullable(),

  customerName: z.string().nullable(),

  invoiceDate: z.string().nullable(),

  dueDate: z.string().nullable(),

  currency: z.string().default('IDR'),

  subtotal: z.number().nullable(),

  tax: z.number().nullable(),

  total: z.number().nullable(),

  items: z.array(invoiceLineItemSchema),
});

export type InvoiceExtraction =
  z.infer<typeof invoiceExtractionSchema>;