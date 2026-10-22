# Style Of Life Amazon Fullstack + Supabase

One project, with separate folders:
- `/frontend` = customer website
- `/backend` = API + private admin portal
- `/supabase.sql` = database setup

Run SQL in Supabase, then set backend environment variables:
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AMAZON_PARTNER_TAG=styleoflife08-21
ADMIN_TOKEN=<strong-secret>

Start:
npm install
npm start

Customer frontend: /
Admin portal: /admin/

The frontend reads active products from `/api/products`.
The admin portal adds products to Supabase.

## Updated behavior
- Customer frontend has no Discover/search control.
- Customer homepage shows products already added in the backend, in randomized order on each page load.
- Admin portal uses a Connect step and a saved admin token to avoid the Add Product button failing silently.

## Important: separate Frontend + Backend deployment
If the admin portal is opened from a different domain than the backend, enter the BACKEND URL at the top of the Admin Portal before clicking Connect.
Example: https://style-of-life-backend.onrender.com
The portal now stores this URL in the browser and sends admin requests to that backend.
