# Style Of Life — Amazon Backend Portal + Supabase

## What this does
A separate backend portal where you can paste Amazon product links and store products in Supabase.

Fields:
- Amazon product URL
- title
- price
- image URL
- badge
- customer advantages
- active/hidden

The backend automatically extracts the ASIN and creates the affiliate URL using `styleoflife08-21`.

## Setup
1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase.sql`.
4. Deploy this backend to Render/Vercel/server.
5. Add environment variables:
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   AMAZON_PARTNER_TAG=styleoflife08-21
   ADMIN_TOKEN=<long random secret>
6. Open the backend URL. Enter ADMIN_TOKEN in the portal.
7. Add Amazon product links.

## Frontend API
Public active products:
GET /api/products

Admin list:
GET /api/products?admin=1 with x-admin-token header

The frontend can use GET /api/products and show only active products.

SECURITY:
- Never put SUPABASE_SERVICE_ROLE_KEY in frontend code.
- Never commit .env.
- The portal is protected by ADMIN_TOKEN. For a larger production setup, add Supabase Auth.
