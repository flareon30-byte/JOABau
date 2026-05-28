-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'RECITAR';

-- AlterEnum
ALTER TYPE "Department" ADD VALUE 'PROTOCOLS';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PROTOCOL_MANAGER';

-- AlterTable
ALTER TABLE "ActivationInfo" ADD COLUMN     "pdfPath" TEXT,
ALTER COLUMN "points" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "city" TEXT,
ADD COLUMN     "klsId" TEXT,
ADD COLUMN     "orderStatus" TEXT DEFAULT 'geplant',
ADD COLUMN     "protocolStatus" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "requiresProtocol" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reciteReason" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'ACTIVATION';

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "bp2FamPoints" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
ADD COLUMN     "bpPoints" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
ADD COLUMN     "brMultiPoints" DOUBLE PRECISION NOT NULL DEFAULT 20.0,
ADD COLUMN     "mduPoints" DOUBLE PRECISION NOT NULL DEFAULT 30.0,
ADD COLUMN     "sduPoints" DOUBLE PRECISION NOT NULL DEFAULT 25.0,
ADD COLUMN     "spPoints" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN     "taPoints" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "addressId" TEXT,
    "createdById" TEXT,
    "targetRole" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;
