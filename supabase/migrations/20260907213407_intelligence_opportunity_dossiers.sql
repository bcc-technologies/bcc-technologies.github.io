-- Curated dossiers are independent of regenerated signals. Only the guarded RPC
-- writes them, so each revision and its evidence are committed atomically.
create table public.intelligence_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 500),
  related_line text not null default 'MAP-Nano' check (related_line in ('MAP-Nano','MAP-Bio','MAP-Med','MAP-Ing','MAPs','General')),
  status text not null check (status in ('candidate','reviewing','validating','validated','rejected','archived')),
  dossier jsonb not null check (jsonb_typeof(dossier) = 'object'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array'),
  review_on date,
  revision integer not null check (revision > 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index intelligence_opportunities_queue_idx on public.intelligence_opportunities (status, review_on, updated_at desc, id);
create table public.intelligence_opportunity_history (
  opportunity_id uuid not null references public.intelligence_opportunities(id),
  revision integer not null,
  actor_id uuid not null,
  recorded_at timestamptz not null default now(),
  snapshot jsonb not null,
  primary key (opportunity_id, revision)
);
alter table public.intelligence_opportunities enable row level security;
alter table public.intelligence_opportunity_history enable row level security;
revoke all on public.intelligence_opportunities, public.intelligence_opportunity_history from public, anon, authenticated;
grant select on public.intelligence_opportunities, public.intelligence_opportunity_history to authenticated;
create policy opportunities_managers_read on public.intelligence_opportunities for select to authenticated using ((select private.can_manage_signals()));
create policy opportunity_history_managers_read on public.intelligence_opportunity_history for select to authenticated using ((select private.can_manage_signals()));

create function private.save_intelligence_opportunity(p_id uuid, p_revision integer, p_dossier jsonb, p_paper_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  previous public.intelligence_opportunities;
  saved public.intelligence_opportunities;
  clean jsonb := '{}'::jsonb;
  evidence_snapshot jsonb;
  field text;
  value text;
  next_status text := coalesce(p_dossier->>'status', 'candidate');
  next_review date;
begin
  if actor is null or not private.can_manage_signals() then
    raise exception 'No tienes permiso para gestionar oportunidades.' using errcode = '42501';
  end if;
  if p_dossier is null or jsonb_typeof(p_dossier) <> 'object' then raise exception 'Ficha inválida.'; end if;
  foreach field in array array['title','related_line','problem','target_user','bcc_fit','hypothesis','next_action','owner','decision_reason','outcome','verification_notes'] loop
    value := btrim(coalesce(p_dossier->>field, ''));
    if length(value) > 6000 then raise exception 'Campo demasiado largo: %', field; end if;
    if field = any(array['title','problem','target_user','bcc_fit','hypothesis','next_action']) and value = '' then
      raise exception 'Completa el campo obligatorio: %', field;
    end if;
    clean := clean || jsonb_build_object(field, value);
  end loop;
  if coalesce(clean->>'related_line','') = '' then clean := clean || '{"related_line":"MAP-Nano"}'::jsonb; end if;
  next_review := nullif(p_dossier->>'review_on','')::date;
  if next_status in ('validating','validated') and ((clean->>'owner') = '' or next_review is null) then
    raise exception 'La validación requiere responsable y fecha de revisión.';
  end if;
  if next_status in ('validated','rejected','archived') and (clean->>'decision_reason') = '' then
    raise exception 'Registra el motivo de la decisión.';
  end if;
  if next_status = 'validated' and ((clean->>'outcome') = '' or (clean->>'verification_notes') = '') then
    raise exception 'Registra el resultado de la prueba y la verificación de fuentes y derechos.';
  end if;
  if p_id is not null then
    select * into previous from public.intelligence_opportunities where id = p_id for update;
    if not found then raise exception 'Oportunidad no encontrada.'; end if;
    if p_revision is distinct from previous.revision then
      raise exception 'La ficha cambió. Recarga antes de guardar para conservar las decisiones de tus compañeros.' using errcode = '40001';
    end if;
  elsif p_revision is distinct from 0 then raise exception 'La ficha nueva debe comenzar en revisión cero.';
  end if;
  if p_paper_ids is null then
    evidence_snapshot := previous.evidence;
  else
    if cardinality(p_paper_ids) < 1 or cardinality(p_paper_ids) > 20 then raise exception 'Selecciona entre 1 y 20 papers.'; end if;
    if exists(select 1 from unnest(p_paper_ids) x(id) where x.id is null or not exists(select 1 from public.intelligence_papers p where p.id = x.id)) then
      raise exception 'Uno de los papers ya no existe. Recarga la selección.';
    end if;
    select jsonb_agg(jsonb_build_object('type','paper','id',p.id,'title',p.title,'url',p.source_url,'doi',p.doi,
      'abstract',p.abstract,'publication_date',p.publication_date,'institutions',p.institutions,'authors',p.authors,
      'captured_at',now(),'source_updated_at',p.updated_at) order by p.id)
      into evidence_snapshot from public.intelligence_papers p where p.id = any(p_paper_ids);
  end if;
  if evidence_snapshot is null or jsonb_array_length(evidence_snapshot) = 0 then raise exception 'La ficha requiere evidencia conservada.'; end if;
  if p_id is null then
    insert into public.intelligence_opportunities(title, related_line, status, dossier, evidence, review_on, revision, created_by, updated_by)
    values(clean->>'title',clean->>'related_line',next_status,clean,evidence_snapshot,next_review,1,actor,actor) returning * into saved;
  else
    update public.intelligence_opportunities set title=clean->>'title', related_line=clean->>'related_line', status=next_status,
      dossier=clean, evidence=evidence_snapshot, review_on=next_review, revision=previous.revision+1, updated_by=actor, updated_at=now()
      where id=p_id returning * into saved;
  end if;
  insert into public.intelligence_opportunity_history(opportunity_id, revision, actor_id, snapshot)
    values(saved.id, saved.revision, actor, to_jsonb(saved));
  return to_jsonb(saved);
end $$;
revoke all on function private.save_intelligence_opportunity(uuid,integer,jsonb,uuid[]) from public,anon;
grant execute on function private.save_intelligence_opportunity(uuid,integer,jsonb,uuid[]) to authenticated;
create function public.save_intelligence_opportunity(p_id uuid, p_revision integer, p_dossier jsonb, p_paper_ids uuid[] default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_intelligence_opportunity(p_id,p_revision,p_dossier,p_paper_ids);
$$;
revoke all on function public.save_intelligence_opportunity(uuid,integer,jsonb,uuid[]) from public,anon;
grant execute on function public.save_intelligence_opportunity(uuid,integer,jsonb,uuid[]) to authenticated;
