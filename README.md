# Style Of Life Amazon — Vercel Ready

This version is designed for Vercel and fixes the "No entrypoint found" error.

## Deploy
1. Upload/import this project to GitHub.
2. In Vercel, import the repository.
3. Keep Root Directory as the repository root.
4. No Build Command is required.
5. Add these Environment Variables:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - AMAZON_PARTNER_TAG = styleoflife08-21
   - ADMIN_TOKEN
   - FRONTEND_URL = * (or your Vercel frontend origin)
6. Deploy.

## URLs after deployment
- Customer: https://YOUR-VERCEL-DOMAIN.vercel.app/
- Admin: https://YOUR-VERCEL-DOMAIN.vercel.app/admin
- Health: https://YOUR-VERCEL-DOMAIN.vercel.app/api/health

Frontend and backend are in one Vercel deployment but remain separated in code:
- frontend/
- api/
- Supabase database

The browser uses same-origin /api requests, so you do not need to enter an Amazon URL or Render URL as the backend URL.
