/*
  Warnings:

  - You are about to drop the column `homeId` on the `ActivationInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ActivationInfo" DROP COLUMN "homeId",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "homeIds" TEXT[],
ADD COLUMN     "isSaturday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "apartmentCount" INTEGER,
ADD COLUMN     "clientName" TEXT;

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "extraPointPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "saturdayPointPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "monthlyTargetPoints" INTEGER NOT NULL DEFAULT 100,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);
