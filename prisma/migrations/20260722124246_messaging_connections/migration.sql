-- CreateTable
CREATE TABLE "MessagingConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerChatId" TEXT,
    "linkToken" TEXT,
    "linkTokenExpiresAt" TIMESTAMP(3),
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagingConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConnection_linkToken_key" ON "MessagingConnection"("linkToken");

-- CreateIndex
CREATE INDEX "MessagingConnection_userId_idx" ON "MessagingConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConnection_userId_provider_key" ON "MessagingConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingConnection_provider_providerChatId_key" ON "MessagingConnection"("provider", "providerChatId");

-- CreateIndex
CREATE INDEX "MessagingEvent_provider_createdAt_idx" ON "MessagingEvent"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "MessagingConnection" ADD CONSTRAINT "MessagingConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
