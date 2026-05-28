-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SystemSettings" ADD COLUMN     "financials" JSONB,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 1500.0,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;
