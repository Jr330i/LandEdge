-- AlterTable
ALTER TABLE "leases" ADD COLUMN     "broker_user_id" UUID;

-- AddForeignKey
ALTER TABLE "leases" ADD CONSTRAINT "leases_broker_user_id_fkey" FOREIGN KEY ("broker_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
