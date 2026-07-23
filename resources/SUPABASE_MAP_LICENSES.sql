-- MAP licensing domain.
-- Prerequisites: SUPABASE_AUTH_SETUP.sql and SUPABASE_CUSTOM_ROLES.sql.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  normalized_name text generated always as (lower(trim(name))) stored unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.map_products (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('map-nano', 'map-bio', 'map-med', 'map-ing')),
  name text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.map_products (key, name) values
  ('map-nano', 'MAP-Nano'),
  ('map-bio', 'MAP-Bio'),
  ('map-med', 'MAP-Med'),
  ('map-ing', 'MAP-Ing')
on conflict (key) do update set name = excluded.name;

create table if not exists public.map_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  contact_email text not null check (length(contact_email) <= 254),
  plan text not null check (plan in ('Individual', 'Equipo', 'Enterprise', 'Prueba')),
  seats integer not null check (seats between 1 and 100000),
  used_seats integer not null default 0 check (used_seats >= 0 and used_seats <= seats),
  status text not null default 'draft'
    check (status in ('draft', 'trial', 'active', 'grace', 'suspended', 'expired', 'cancelled')),
  platform text not null default 'Web' check (platform in ('Web', 'Desktop', 'Web + Desktop')),
  starts_at date not null default current_date,
  ends_at date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists map_licenses_organization_idx on public.map_licenses (organization_id);
create index if not exists map_licenses_status_ends_idx on public.map_licenses (status, ends_at);

create table if not exists public.map_license_entitlements (
  license_id uuid not null references public.map_licenses(id) on delete cascade,
  product_id uuid not null references public.map_products(id),
  created_at timestamptz not null default now(),
  primary key (license_id, product_id)
);

create table if not exists public.map_license_events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.map_licenses(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists map_license_events_license_created_idx
  on public.map_license_events (license_id, created_at desc);

create or replace function public.touch_map_license_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_map_license_updated_at on public.map_licenses;
create trigger touch_map_license_updated_at
before update on public.map_licenses
for each row execute function public.touch_map_license_updated_at();

alter table public.organizations enable row level security;
alter table public.map_products enable row level security;
alter table public.map_licenses enable row level security;
alter table public.map_license_entitlements enable row level security;
alter table public.map_license_events enable row level security;

create or replace function private.has_license_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.role = 'admin'
        or exists (
          select 1
          from public.workspace_role_definitions definition
          where definition.id = any(coalesce(profile.custom_roles, array[]::text[]))
            and (
              permission_name = any(coalesce(definition.permissions, array[]::text[]))
              or (
                permission_name = 'licenses:view'
                and (
                  'licenses:manage' = any(coalesce(definition.permissions, array[]::text[]))
                  or 'licenses:assign' = any(coalesce(definition.permissions, array[]::text[]))
                )
              )
            )
        )
      )
  );
$$;

revoke all on function public.touch_map_license_updated_at() from public, anon;
revoke all on function private.has_license_permission(text) from public, anon;
grant execute on function private.has_license_permission(text) to authenticated, service_role;

drop policy if exists "license admins read organizations" on public.organizations;
drop policy if exists "licensed staff read organizations" on public.organizations;
create policy "licensed staff read organizations"
on public.organizations for select to authenticated
using ((select private.has_license_permission('licenses:view')));

drop policy if exists "license admins read products" on public.map_products;
drop policy if exists "licensed staff read products" on public.map_products;
create policy "licensed staff read products"
on public.map_products for select to authenticated
using ((select private.has_license_permission('licenses:view')));

drop policy if exists "license admins read licenses" on public.map_licenses;
drop policy if exists "licensed staff read licenses" on public.map_licenses;
create policy "licensed staff read licenses"
on public.map_licenses for select to authenticated
using ((select private.has_license_permission('licenses:view')));

drop policy if exists "license admins read entitlements" on public.map_license_entitlements;
drop policy if exists "licensed staff read entitlements" on public.map_license_entitlements;
create policy "licensed staff read entitlements"
on public.map_license_entitlements for select to authenticated
using ((select private.has_license_permission('licenses:view')));

drop policy if exists "license admins read events" on public.map_license_events;
drop policy if exists "license auditors read events" on public.map_license_events;
create policy "license auditors read events"
on public.map_license_events for select to authenticated
using ((select private.has_license_permission('licenses:audit')));

create or replace function private.create_map_license(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_organization_id uuid;
  target_license_id uuid;
  organization_name text := trim(coalesce(payload->>'organization', ''));
  email_address text := lower(trim(coalesce(payload->>'contactEmail', '')));
  product_names text[];
  seat_count integer;
begin
  if not private.has_license_permission('licenses:manage') then
    raise exception 'Permiso insuficiente';
  end if;
  if organization_name = '' or length(organization_name) > 120 then
    raise exception 'Organización inválida';
  end if;
  if email_address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(email_address) > 254 then
    raise exception 'Correo de contacto inválido';
  end if;
  if jsonb_typeof(payload->'products') is distinct from 'array' then
    raise exception 'Selecciona al menos un producto MAP';
  end if;

  select array_agg(distinct value order by value)
  into product_names
  from jsonb_array_elements_text(payload->'products') product(value);

  if coalesce(cardinality(product_names), 0) = 0
     or exists (
       select 1 from unnest(product_names) selected(name)
       where not exists (
         select 1 from public.map_products product
         where product.name = selected.name and product.enabled
       )
     ) then
    raise exception 'Producto MAP inválido';
  end if;

  begin
    seat_count := coalesce(nullif(payload->>'seats', '')::integer, 1);
  exception when invalid_text_representation then
    raise exception 'Cantidad de asientos inválida';
  end;
  if seat_count not between 1 and 100000 then
    raise exception 'Cantidad de asientos inválida';
  end if;

  insert into public.organizations (name)
  values (organization_name)
  on conflict (normalized_name) do update set updated_at = now()
  returning id into target_organization_id;

  insert into public.map_licenses (
    organization_id, contact_email, plan, seats, status, platform,
    starts_at, ends_at, created_by
  )
  values (
    target_organization_id,
    email_address,
    coalesce(nullif(payload->>'plan', ''), 'Equipo'),
    seat_count,
    coalesce(nullif(payload->>'status', ''), 'draft'),
    coalesce(nullif(payload->>'platform', ''), 'Web'),
    coalesce(nullif(payload->>'startsAt', '')::date, current_date),
    nullif(payload->>'endsAt', '')::date,
    auth.uid()
  )
  returning id into target_license_id;

  insert into public.map_license_entitlements (license_id, product_id)
  select target_license_id, product.id
  from public.map_products product
  where product.name = any(product_names);

  insert into public.map_license_events (license_id, actor_id, event_type, after_state)
  values (target_license_id, auth.uid(), 'license.created', payload);

  return target_license_id;
end;
$$;

create or replace function private.set_map_license_status(target_license_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_row jsonb;
  after_row jsonb;
begin
  if not private.has_license_permission('licenses:manage') then
    raise exception 'Permiso insuficiente';
  end if;
  if next_status not in ('draft', 'trial', 'active', 'grace', 'suspended', 'expired', 'cancelled') then
    raise exception 'Estado inválido';
  end if;

  select to_jsonb(license)
  into before_row
  from public.map_licenses license
  where license.id = target_license_id
  for update;

  if not found then
    raise exception 'Licencia no encontrada';
  end if;

  update public.map_licenses
  set status = next_status
  where id = target_license_id
  returning to_jsonb(map_licenses) into after_row;

  insert into public.map_license_events (
    license_id, actor_id, event_type, before_state, after_state
  )
  values (
    target_license_id, auth.uid(), 'license.status_changed', before_row, after_row
  );
end;
$$;

create or replace function public.create_map_license(payload jsonb)
returns uuid
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.create_map_license(payload);
$$;

create or replace function public.set_map_license_status(target_license_id uuid, next_status text)
returns void
language sql
security invoker
set search_path = public, private, pg_temp
as $$
  select private.set_map_license_status(target_license_id, next_status);
$$;

revoke all on function private.create_map_license(jsonb) from public, anon;
revoke all on function private.set_map_license_status(uuid, text) from public, anon;
grant execute on function private.create_map_license(jsonb) to authenticated, service_role;
grant execute on function private.set_map_license_status(uuid, text) to authenticated, service_role;

revoke all on function public.create_map_license(jsonb) from public, anon;
revoke all on function public.set_map_license_status(uuid, text) from public, anon;
revoke all on public.organizations, public.map_products, public.map_licenses,
  public.map_license_entitlements, public.map_license_events from public, anon;

grant select on public.organizations, public.map_products, public.map_licenses,
  public.map_license_entitlements, public.map_license_events to authenticated;
grant execute on function public.create_map_license(jsonb) to authenticated, service_role;
grant execute on function public.set_map_license_status(uuid, text) to authenticated, service_role;
