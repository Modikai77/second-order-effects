# Second-Order Effects Engine

Single-user local MVP for structured causal analysis and portfolio stress-testing.

## Stack
- Next.js (App Router, TypeScript)
- Prisma + SQLite
- OpenAI Responses API
- Zod validation + deterministic scoring
- Vitest + Testing Library

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env and fill API key:
   ```bash
   cp .env.example .env
   ```
3. Run migrations and generate client:
   ```bash
   npm run prisma:migrate
   npm run prisma:generate
   ```
   If migration state is inconsistent (common on upgraded local DBs), run:
   ```bash
   npx prisma migrate reset
   ```
   to rebuild the local SQLite database from migration history.
4. Optional seed:
   ```bash
   npm run prisma:seed
   ```
5. Optional bootstrap legacy data ownership (when upgrading from single-user DB):
   ```bash
   npm run tenant:bootstrap
   ```
6. Start app:
   ```bash
   npm run dev
   ```

## Multi-User Setup
- First user session is created via `/auth/register`.
- Migration adds `User`, `Account`, `Session`, and `VerificationToken` tables and scoped `userId` columns.
- Legacy rows can be assigned to a local bootstrap user with `npm run tenant:bootstrap`.

## API
- `POST /api/themes/analyze`
- `GET /api/themes?page=1&pageSize=10`
- `GET /api/themes/:id`
- `PATCH /api/invalidation/:id`
- `GET /api/scenarios`
- `POST /api/scenarios`
- `GET /api/scenarios/:id`
- `POST /api/auth/register` (public)
- NextAuth session endpoints at `/api/auth/*`

## Authentication
- Login: `/auth/login`
- Register: `/auth/register`
- All theme/scenario/invalidation routes are user-scoped and require authentication.

## Notes
- On model schema failure after one retry, a neutral error snapshot is persisted.
- Leading indicators are manually tracked in MVP.

## CSV Portfolio Scenario Upload
Use the `Portfolio Scenarios` panel in the UI to upload a CSV and save it for reuse.

Required header:
- `name`

Optional headers:
- `ticker`
- `weight` (decimal `0.25` or percent style `25`)
- `amount` / `value` (currency values like `£12,500` are supported and auto-converted to weights if no `weight` column is provided)
- `sensitivity` (`LOW`, `MED`, `HIGH`; defaults to `MED`)
- `tags` (separate multiple with `,`, `;`, or `|`)

Importer behavior:
- Detects the real header row even if the CSV has title rows above it.
- If multiple date columns are present (e.g. `05/12/2025`, `11/02/2026`), it uses the latest date column for `£` amount-to-weight conversion.
- Stops ingesting rows at the `Summary` section.
