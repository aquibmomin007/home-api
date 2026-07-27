-- CreateTable
CREATE TABLE "flight_deal_states" (
    "id" TEXT NOT NULL,
    "itineraryKey" TEXT NOT NULL,
    "routeType" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "windowLabel" TEXT NOT NULL,
    "outboundDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "lastSeenPrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SGD',
    "cabin" TEXT NOT NULL,
    "stops" INTEGER NOT NULL,
    "airline" TEXT NOT NULL,
    "baggageIncluded" BOOLEAN NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAlertPrice" INTEGER,
    "lastAlertAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flight_deal_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "flight_deal_states_itineraryKey_key" ON "flight_deal_states"("itineraryKey");

-- CreateIndex
CREATE INDEX "flight_deal_states_destination_routeType_idx" ON "flight_deal_states"("destination", "routeType");

-- CreateIndex
CREATE INDEX "flight_deal_states_lastSeenAt_idx" ON "flight_deal_states"("lastSeenAt");
