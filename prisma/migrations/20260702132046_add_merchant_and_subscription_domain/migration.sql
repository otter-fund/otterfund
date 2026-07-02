-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "domain" TEXT;

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "domain" TEXT,
    "isCompany" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'claude',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_normalizedKey_key" ON "Merchant"("normalizedKey");
