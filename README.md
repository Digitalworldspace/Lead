# Style Of Life — Amazon + Supabase + Vercel

## Architecture
- Customer website: `/`
- Private admin portal: `/admin`
- Vercel API: `/api/*`
- Database: Supabase
- Amazon affiliate: manual Amazon.com links
- Partner tag: `styleoflife08-21`

## Vercel deployment
1. Put the contents of this project in GitHub (or upload/import the ZIP in Vercel).
2. Import the repository into Vercel.
3. Root Directory must be the repository root.
4. Framework Preset can stay Other.
5. Build Command: leave empty/default.
6. Output Directory: leave empty/default.
7. Add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AMAZON_PARTNER_TAG` = `styleoflife08-21`
   - `ADMIN_TOKEN` = a long private password
   - `FRONTEND_URL` = `*` (or your exact Vercel domain)
8. Deploy.

## Supabase
Open Supabase → SQL Editor → run `supabase.sql`.

## Test after deployment
Open:
`https://YOUR-DOMAIN.vercel.app/api/health`

It should return JSON with `ok: true`.

Then open:
`https://YOUR-DOMAIN.vercel.app/admin`

Enter only your ADMIN_TOKEN and click Connect.

## Adding products
Use an Amazon.com product URL such as:
`https://www.amazon.com/dp/B0XXXXXXXX`

The portal extracts the ASIN and creates the affiliate URL automatically.

Important: this build intentionally accepts Amazon.com because `styleoflife08-21` is the Amazon US partner tag. Do not paste an Amazon.in URL here unless you have an India Associates tag and want the code changed for that marketplace.

Title, price, image URL and advantages are manual fields. Amazon is not scraped and no Amazon API credentials are required.

## Security
Never put `SUPABASE_SERVICE_ROLE_KEY` or `ADMIN_TOKEN` in frontend code or commit a real `.env` file to GitHub.
