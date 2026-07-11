-- CreateTable
CREATE TABLE "AiRecommendationCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "responseJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRecommendationCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiRecommendationCache_cacheKey_key" ON "AiRecommendationCache"("cacheKey");

-- CreateIndex
CREATE INDEX "AiRecommendationCache_userId_idx" ON "AiRecommendationCache"("userId");

-- CreateIndex
CREATE INDEX "AiRecommendationCache_expiresAt_idx" ON "AiRecommendationCache"("expiresAt");

-- AddForeignKey
ALTER TABLE "AiRecommendationCache" ADD CONSTRAINT "AiRecommendationCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
