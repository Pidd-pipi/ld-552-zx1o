-- AlterEnum
ALTER TYPE "OfferStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- CreateEnum
CREATE TYPE "OfferApprovalDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "approvedVersion" INTEGER,
ADD COLUMN "assignedApproverId" INTEGER,
ADD COLUMN "sentAt" TIMESTAMP(3);

-- Backfill assigned approver from the job's hiring manager, then from approverId
UPDATE "Offer" o SET "assignedApproverId" = j."hiringManagerId"
FROM "Job" j
WHERE o."jobId" = j.id AND o."assignedApproverId" IS NULL;

UPDATE "Offer" SET "assignedApproverId" = "approverId" WHERE "assignedApproverId" IS NULL;

ALTER TABLE "Offer" ALTER COLUMN "assignedApproverId" SET NOT NULL;
ALTER TABLE "Offer" ALTER COLUMN "approverId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "OfferApproval" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "decision" "OfferApprovalDecision" NOT NULL,
    "salary" DECIMAL(65,30) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "actorId" INTEGER,
    "assignedApproverId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_assignedApproverId_idx" ON "Offer"("assignedApproverId");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "OfferApproval_offerId_idx" ON "OfferApproval"("offerId");

-- CreateIndex
CREATE INDEX "OfferApproval_assignedApproverId_idx" ON "OfferApproval"("assignedApproverId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_assignedApproverId_fkey" FOREIGN KEY ("assignedApproverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
