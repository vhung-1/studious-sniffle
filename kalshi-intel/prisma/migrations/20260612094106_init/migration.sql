-- CreateTable
CREATE TABLE "trades" (
    "trade_id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "count_fp" DECIMAL(20,4) NOT NULL,
    "yes_price_dollars" DECIMAL(10,4) NOT NULL,
    "no_price_dollars" DECIMAL(10,4) NOT NULL,
    "created_time" TIMESTAMPTZ(6) NOT NULL,
    "is_block_trade" BOOLEAN NOT NULL,
    "taker_side" TEXT,
    "ingested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("trade_id")
);

-- CreateTable
CREATE TABLE "ingest_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_created_time" TIMESTAMPTZ(6),
    "last_trade_id" TEXT,
    "total_ingested" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingest_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trades_ticker_idx" ON "trades"("ticker");

-- CreateIndex
CREATE INDEX "trades_created_time_idx" ON "trades"("created_time");

-- CreateIndex
CREATE INDEX "trades_is_block_trade_idx" ON "trades"("is_block_trade");

-- CreateIndex
CREATE INDEX "trades_ticker_created_time_idx" ON "trades"("ticker", "created_time");

-- CreateIndex
CREATE INDEX "trades_created_time_is_block_trade_idx" ON "trades"("created_time", "is_block_trade");
