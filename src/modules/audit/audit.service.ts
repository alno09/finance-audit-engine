import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

import { PrismaService } from '../../infrastructure/database/prisma.service';

type AuditFindingInput = Pick<
  Prisma.AuditFindingCreateManyInput,
  'type' | 'severity' | 'message' | 'expectedValue' | 'actualValue'
>;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async auditInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },

      include: {
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const findings: AuditFindingInput[] = [];

    if (!invoice.vendorName) {
      findings.push({
        type: 'MISSING_VENDOR',
        severity: 'ERROR',
        message: 'Invoice vendor is missing.',
      });
    }

    if (!invoice.invoiceNumber) {
      findings.push({
        type: 'MISSING_INVOICE_NUMBER',
        severity: 'ERROR',
        message: 'Invoice number is missing.',
      });
    }

    for (const item of invoice.lineItems) {
      if (
        item.quantity === null ||
        item.unitPrice === null ||
        item.total === null
      ) {
        continue;
      }

      const expected = item.quantity.mul(item.unitPrice);

      if (!expected.equals(item.total)) {
        findings.push({
          type: 'LINE_TOTAL_MISMATCH',
          severity: 'ERROR',

          message: `Line item "${item.description}" total does not match quantity × unit price.`,

          expectedValue: expected.toString(),

          actualValue: item.total.toString(),
        });
      }
    }

    const calculatedSubtotal = invoice.lineItems.reduce((sum, item) => {
      if (item.total === null) {
        return sum;
      }

      return sum.add(item.total);
    }, new Prisma.Decimal(0));

    if (
      invoice.subtotal !== null &&
      !calculatedSubtotal.equals(invoice.subtotal)
    ) {
      findings.push({
        type: 'SUBTOTAL_MISMATCH',
        severity: 'ERROR',

        message: 'Invoice subtotal does not match the sum of line items.',

        expectedValue: calculatedSubtotal.toString(),

        actualValue: invoice.subtotal.toString(),
      });
    }

    if (
      invoice.subtotal !== null &&
      invoice.tax !== null &&
      invoice.total !== null
    ) {
      const expectedTotal = invoice.subtotal.add(invoice.tax);

      if (!expectedTotal.equals(invoice.total)) {
        findings.push({
          type: 'TOTAL_MISMATCH',
          severity: 'ERROR',

          message: 'Invoice total does not match subtotal + tax.',

          expectedValue: expectedTotal.toString(),

          actualValue: invoice.total.toString(),
        });
      }
    }

    if (invoice.vendorName && invoice.invoiceNumber) {
      const duplicate = await this.prisma.invoice.findFirst({
        where: {
          id: {
            not: invoice.id,
          },

          vendorName: invoice.vendorName,

          invoiceNumber: invoice.invoiceNumber,
        },
      });

      if (duplicate) {
        findings.push({
          type: 'DUPLICATE_INVOICE',
          severity: 'ERROR',

          message:
            'Another invoice with the same vendor and invoice number already exists.',
        });
      }
    }

    const hasErrors = findings.some((finding) => finding.severity === 'ERROR');

    const auditStatus = hasErrors ? 'NEEDS_REVIEW' : 'PASSED';

    this.logger.log(
      `Audit completed for invoice ${invoiceId}. Status: ${auditStatus}. Findings: ${findings.length}`,
    );

    for (const finding of findings) {
      this.logger.log(
        `Finding - Type: ${finding.type}, Severity: ${finding.severity}, Message: ${finding.message}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const audit = await tx.audit.upsert({
        where: {
          invoiceId,
        },

        create: {
          invoiceId,
          status: auditStatus,
        },

        update: {
          status: auditStatus,
        },
      });

      await tx.auditFinding.deleteMany({
        where: {
          auditId: audit.id,
        },
      });

      if (findings.length > 0) {
        await tx.auditFinding.createMany({
          data: findings.map((finding) => ({
            auditId: audit.id,

            ...finding,
          })),
        });
      }

      return {
        audit,
        findings,
      };
    });
  }
}
