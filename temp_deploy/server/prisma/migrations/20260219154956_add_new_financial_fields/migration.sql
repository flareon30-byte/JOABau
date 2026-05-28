-- AlterTable
ALTER TABLE "ActivationInfo" ADD COLUMN     "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "isRepair" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mduInstalled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mduPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "repairPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "spPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "taPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ALTER COLUMN "spInstalled" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "scheduledById" TEXT;

-- CreateTable
CREATE TABLE "Repair" (
    "id" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photos" TEXT[],
    "technicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repair_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repair" ADD CONSTRAINT "Repair_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;
