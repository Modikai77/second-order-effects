-- CreateTable
CREATE TABLE "portfolio_scenarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "scenario_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenario_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "weight" REAL,
    "sensitivity" TEXT NOT NULL,
    "exposure_tags" JSON NOT NULL,
    "order_index" INTEGER NOT NULL,
    CONSTRAINT "scenario_holdings_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "portfolio_scenarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
