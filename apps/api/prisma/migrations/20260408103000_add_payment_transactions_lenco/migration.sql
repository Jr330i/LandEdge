-- Create enums for payment provider/transaction state
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN
    CREATE TYPE "PaymentProvider" AS ENUM ('LENCO');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentTransactionStatus') THEN
    CREATE TYPE "PaymentTransactionStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
  END IF;
END $$;

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "provider_reference" TEXT NOT NULL,
  "checkout_url" TEXT,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'INITIATED',
  "settled_at" TIMESTAMP(3),
  "raw_request" JSONB,
  "raw_response" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_provider_provider_reference_key"
ON "payment_transactions"("provider", "provider_reference");

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_transactions_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
