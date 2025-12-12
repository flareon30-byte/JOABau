-- DropForeignKey
ALTER TABLE "ActivationInfo" DROP CONSTRAINT "ActivationInfo_addressId_fkey";

-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT "Address_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_addressId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "FusionInfo" DROP CONSTRAINT "FusionInfo_addressId_fkey";

-- DropForeignKey
ALTER TABLE "SopladoInfo" DROP CONSTRAINT "SopladoInfo_addressId_fkey";

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopladoInfo" ADD CONSTRAINT "SopladoInfo_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FusionInfo" ADD CONSTRAINT "FusionInfo_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationInfo" ADD CONSTRAINT "ActivationInfo_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;
