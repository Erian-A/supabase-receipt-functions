# supabase-receipt-functions

Supabase Edge Functions (Deno) that back the [qr-receipt-scanner](https://github.com/Erian-A/qr-receipt-scanner) app. The client scans a QR code on a Brazilian electronic receipt (NFC-e), hits these functions to parse and persist the data, and reads it back for display.

## Functions

| Name | Purpose |
|---|---|
| `receita-parser` | Fetches/parses the SEFAZ receipt HTML and upserts the receipt + line items into the `receipt` / `product` tables. |
| `get-receipts` | Paginated listing of stored receipts. Supports cursor (default) and offset modes via query params (`pageSize`, `cursor`, `page`, `orderBy`, `orderDir`). |
| `latest-receipt-health` | Health check — returns the most recently created receipt, or `healthy` with `latest: null` if the table is empty. |

## Requirements

- [Supabase CLI](https://supabase.com/docs/guides/cli) (installed as a dev dep — `npm install`)
- [Deno](https://deno.com/) (used by the Supabase CLI to run the functions locally)
- A Supabase project with a `receipt` table (and a `product` table for `receita-parser`)

## Run locally

```bash
npm install
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run serve
```

Functions are then reachable at `http://localhost:54321/functions/v1/<function-name>`.

## Deploy

All at once:

```bash
npm run deploy
```

Or individually:

```bash
npm run deploy:get-receipts
npm run deploy:latest-receipt-health
npm run deploy:receita-parser
```

## Environment variables

Set these as Supabase function secrets (`supabase secrets set KEY=value`):

- `SUPABASE_URL` — auto-injected in production
- `SUPABASE_ANON_KEY` — auto-injected; used by `get-receipts` to honor caller RLS
- `SUPABASE_SERVICE_ROLE_KEY` — required by `latest-receipt-health` and `receita-parser` for privileged DB writes

## IDE note

These run on Deno, not Node. If your editor reports `Cannot find name 'Deno'` or can't resolve `jsr:`/`npm:` specifiers, enable the [Deno VSCode extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) scoped to `./supabase/functions`.
