import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';

import { InvoiceExtraction } from '../extraction/schemas/invoice.schema';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async saveFromExtraction(
    documentId: string,
    data: InvoiceExtraction,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const invoice =
          await tx.invoice.upsert({
            where: {
              documentId,
            },

            create: {
              documentId,

              invoiceNumber:
                data.invoiceNumber,

              vendorName:
                data.vendorName,

              customerName:
                data.customerName,

              invoiceDate:
                data.invoiceDate
                  ? new Date(
                      data.invoiceDate,
                    )
                  : null,

              dueDate:
                data.dueDate
                  ? new Date(
                      data.dueDate,
                    )
                  : null,

              currency:
                data.currency,

              subtotal:
                data.subtotal,

              tax:
                data.tax,

              total:
                data.total,
            },

            update: {
              invoiceNumber:
                data.invoiceNumber,

              vendorName:
                data.vendorName,

              customerName:
                data.customerName,

              invoiceDate:
                data.invoiceDate
                  ? new Date(
                      data.invoiceDate,
                    )
                  : null,

              dueDate:
                data.dueDate
                  ? new Date(
                      data.dueDate,
                    )
                  : null,

              currency:
                data.currency,

              subtotal:
                data.subtotal,

              tax:
                data.tax,

              total:
                data.total,
            },
          });

        await tx.invoiceLineItem.deleteMany({
          where: {
            invoiceId:
              invoice.id,
          },
        });

        if (data.items.length > 0) {
          await tx.invoiceLineItem.createMany({
            data:
              data.items.map(
                (item) => ({
                  invoiceId:
                    invoice.id,

                  description:
                    item.description,

                  quantity:
                    item.quantity,

                  unitPrice:
                    item.unitPrice,

                  total:
                    item.total,
                }),
              ),
          });
        }

        return invoice;
      },
    );
  }
}