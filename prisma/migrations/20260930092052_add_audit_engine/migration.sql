-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "AuditFindingType" AS ENUM ('LINE_TOTAL_MISMATCH', 'SUBTOTAL_MISMATCH', 'TOTAL_MISMATCH', 'MISSING_VENDOR', 'MISSING_INVOICE_NUMBER', 'DUPLICATE_INVOICE');

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "type" "AuditFindingType" NOT NULL,
    "severity" "AuditSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "expectedValue" TEXT,
    "actualValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Audit_invoiceId_key" ON "Audit"("invoiceId");

-- CreateIndex
CREATE INDEX "AuditFinding_auditId_idx" ON "AuditFinding"("auditId");

-- CreateIndex
CREATE INDEX "AuditFinding_type_idx" ON "AuditFinding"("type");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
