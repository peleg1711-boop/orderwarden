-- CreateTable: EtsyConnection
CREATE TABLE "EtsyConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "etsyUserId" TEXT NOT NULL,
    "etsyShopId" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "codeVerifier" TEXT,
    "oauthState" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtsyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EtsyConnection_userId_key" ON "EtsyConnection"("userId");

-- CreateIndex
CREATE INDEX "EtsyConnection_userId_idx" ON "EtsyConnection"("userId");

-- CreateIndex
CREATE INDEX "EtsyConnection_etsyShopId_idx" ON "EtsyConnection"("etsyShopId");

-- AddForeignKey
ALTER TABLE "EtsyConnection" ADD CONSTRAINT "EtsyConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
