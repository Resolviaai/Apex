-- 1. Helper functions to extract metadata server-side via PostgREST headers
-- These pull standard headers pushed by Supabase's API & Cloudflare stack
create or replace function public.client_ip() returns text as $$
  select nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), '');
$$ language sql stable;

create or replace function public.client_country() returns text as $$
  select current_setting('request.headers', true)::json->>'cf-ipcountry';
$$ language sql stable;

create or replace function public.client_user_agent() returns text as $$
  select current_setting('request.headers', true)::json->>'user-agent';
$$ language sql stable;

-- 2. Create the centralized leads table
create table public.leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Sourced from the frontend directly
  portfolio_id uuid not null,       
  portfolio_url text,               
  name text not null,
  email text not null,
  project_details text,
  
  -- Spam check (honeypot filled bool)
  is_spam boolean default false,     
  
  -- Automatically pulling from headers securely Server-side
  ip_address text default public.client_ip(),
  location text default public.client_country(),
  user_agent text default public.client_user_agent()
);

-- 3. Turn on Row Level Security (CRITICAL for hard-coded anon keys)
alter table public.leads enable row level security;

-- 4. Allow ANYONE visiting your websites to insert a new lead anonymously
create policy "Allow public inserts" on public.leads for insert with check (true);

-- Explicitly NO policies exist for SELECT, UPDATE, or DELETE to ensure read-only privacy for visitors.
