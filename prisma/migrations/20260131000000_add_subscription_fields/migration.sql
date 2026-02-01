-- Add LemonSqueezy subscription fields to User table
ALTER TABLE "User" ADD COLUMN "lemonSqueezyCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN "subscriptionEndsAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "monthlyOrderCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "orderCountResetAt" TIMESTAMP(3);
