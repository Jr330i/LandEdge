-- Default currency/timezone for Zambia (ZMW / Africa-Lusaka).
ALTER TABLE "organizations" ALTER COLUMN "base_currency" SET DEFAULT 'ZMW';
ALTER TABLE "organizations" ALTER COLUMN "timezone" SET DEFAULT 'Africa/Lusaka';
ALTER TABLE "charge_schedules" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "ledger_entries" ALTER COLUMN "currency" SET DEFAULT 'ZMW';
ALTER TABLE "payment_transactions" ALTER COLUMN "currency" SET DEFAULT 'ZMW';

UPDATE "organizations" SET "base_currency" = 'ZMW' WHERE "base_currency" IN ('ZAR', 'ZMK');
UPDATE "organizations" SET "timezone" = 'Africa/Lusaka' WHERE "timezone" = 'Africa/Johannesburg';
UPDATE "charge_schedules" SET "currency" = 'ZMW' WHERE "currency" IN ('ZAR', 'ZMK');
UPDATE "invoices" SET "currency" = 'ZMW' WHERE "currency" IN ('ZAR', 'ZMK');
UPDATE "ledger_entries" SET "currency" = 'ZMW' WHERE "currency" IN ('ZAR', 'ZMK');
UPDATE "payment_transactions" SET "currency" = 'ZMW' WHERE "currency" IN ('ZAR', 'ZMK');
