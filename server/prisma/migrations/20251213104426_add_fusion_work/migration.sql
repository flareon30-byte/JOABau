-- CreateTable
CREATE TABLE "FusionWork" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "nvtName" TEXT NOT NULL,
    "fusionCount" INTEGER NOT NULL,
    "isTray" BOOLEAN NOT NULL DEFAULT false,
    "photos" TEXT[],
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FusionWork_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FusionWork" ADD CONSTRAINT "FusionWork_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
