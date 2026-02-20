-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "VacationType" AS ENUM ('VACATION', 'DAY_OFF');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vacationDaysTotal" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "VacationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" "VacationType" NOT NULL DEFAULT 'VACATION',
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "managerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VacationRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VacationRequest" ADD CONSTRAINT "VacationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
