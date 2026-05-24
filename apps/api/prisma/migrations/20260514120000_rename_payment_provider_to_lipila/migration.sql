-- Rename legacy Lenco enum label to Lipila (PostgreSQL enum value rename).
ALTER TYPE "PaymentProvider" RENAME VALUE 'LENCO' TO 'LIPILA';
