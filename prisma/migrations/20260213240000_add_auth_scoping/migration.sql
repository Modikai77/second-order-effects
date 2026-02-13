-- Users table for credentials authentication
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "email_verified" DATETIME,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- NextAuth adapter tables
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_provider_providerAccountId_key" UNIQUE ("provider","provider_account_id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_token" TEXT NOT NULL UNIQUE,
    "user_id" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    PRIMARY KEY ("identifier", "token")
);

CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "themes_userId_idx" ON "themes"("user_id");
CREATE INDEX IF NOT EXISTS "portfolio_scenarios_userId_idx" ON "portfolio_scenarios"("user_id");

-- Add ownership columns. Keep nullable so legacy rows can be backfilled safely.
ALTER TABLE "themes" ADD COLUMN "user_id" TEXT;
ALTER TABLE "portfolio_scenarios" ADD COLUMN "user_id" TEXT;
