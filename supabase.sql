create table if not exists public.amazon_products (
 id uuid primary key default gen_random_uuid(),
 amazon_url text not null,
 affiliate_url text not null,
 asin text,
 title text not null default 'Amazon Product',
 price text,
 image_url text,
 badge text not null default 'Style Of Life Pick',
 advantages jsonb not null default '[]'::jsonb,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists amazon_products_active_idx on public.amazon_products(active,created_at desc);
alter table public.amazon_products enable row level security;
