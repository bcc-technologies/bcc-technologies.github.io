insert into public.intelligence_api_clients (name, token_hash, token_prefix, scopes, enabled, rate_limit_per_minute, daily_limit)
values ('chatgpt-intelligence', 'c6a4ba38934380f4c8938fdc18e3123048386d48713d358ffe81c18251444b56', 'bcc_agent_-te5CSS6nq', array['intelligence:read']::text[], true, 60, 5000)
on conflict (lower(name)) do update
set token_hash = excluded.token_hash,
    token_prefix = excluded.token_prefix,
    scopes = excluded.scopes,
    enabled = true,
    rate_limit_per_minute = excluded.rate_limit_per_minute,
    daily_limit = excluded.daily_limit,
    updated_at = now();;
