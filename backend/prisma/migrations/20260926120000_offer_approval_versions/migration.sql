-- Enum: Offer 新增「待审批」状态
ALTER TYPE "OfferStatus" ADD VALUE 'PENDING_APPROVAL';

-- Enum: Offer 审批动作
CREATE TYPE "OfferApprovalDecision" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- AlterTable: Offer 支持版本化审批
ALTER TABLE "Offer" ALTER COLUMN "approverId" DROP NOT NULL;
ALTER TABLE "Offer" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Offer" ADD COLUMN "approvedVersion" INTEGER;
ALTER TABLE "Offer" ADD COLUMN "sentAt" TIMESTAMP(3);

-- CreateTable: Offer 条件版本快照
CREATE TABLE "OfferVersion" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "salary" DECIMAL(65,30) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Offer 审批记录（提交 / 通过 / 拒绝）
CREATE TABLE "OfferApproval" (
    "id" SERIAL NOT NULL,
    "offerId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "decision" "OfferApprovalDecision" NOT NULL,
    "reason" TEXT,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfferVersion_offerId_version_key" ON "OfferVersion"("offerId", "version");
CREATE INDEX "OfferApproval_offerId_idx" ON "OfferApproval"("offerId");

-- AddForeignKey
ALTER TABLE "OfferVersion" ADD CONSTRAINT "OfferVersion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "OfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfferApproval" ADD CONSTRAINT "OfferApproval_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: 为已存在的 Offer 补一条 v1 条件快照
INSERT INTO "OfferVersion" ("offerId", "version", "salary", "startDate")
SELECT "id", 1, "salary", "startDate" FROM "Offer";

-- Backfill: 已处于审批后状态的 Offer，其 v1 视为已通过版本
UPDATE "Offer" SET "approvedVersion" = 1
WHERE "status" IN ('APPROVED', 'SENT', 'ACCEPTED', 'WITHDRAWN') AND "approvedVersion" IS NULL;
