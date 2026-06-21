-- BCC Intelligence initial topics seed.
-- Run after SUPABASE_WORKSPACE_INTELLIGENCE.sql

do $$
declare
  item jsonb;
begin
  for item in
    select * from jsonb_array_elements(
      '[
        {
          "name": "MAP-Nano",
          "description": "Monitoreo de analitica de imagen y caracterizacion de materiales a escala micro y nano para BCC MAP-Nano.",
          "category": "nano",
          "keywords": [
            "SEM image analysis",
            "TEM image analysis",
            "nanoparticle size distribution",
            "particle segmentation",
            "microstructure analysis",
            "grain boundary detection",
            "porosity analysis",
            "surface roughness microscopy",
            "materials characterization",
            "nanomaterials microscopy"
          ]
        },
        {
          "name": "MAP-Bio",
          "description": "Monitoreo de vision computacional y analitica de imagen biologica para microscopia, conteo y clasificacion.",
          "category": "bio",
          "keywords": [
            "cell morphology analysis",
            "microscopy image segmentation",
            "diatom classification",
            "biological image analysis",
            "cell counting",
            "cell tracking",
            "brightfield microscopy",
            "phase contrast microscopy",
            "microbial image analysis"
          ]
        },
        {
          "name": "MAP-Med",
          "description": "Monitoreo de patologia digital, citologia y analitica de imagen medica relevante para BCC MAP-Med.",
          "category": "med",
          "keywords": [
            "histopathology image analysis",
            "medical microscopy",
            "cytology image analysis",
            "pathology AI",
            "tissue segmentation",
            "diagnostic image analysis",
            "biomedical image analysis"
          ]
        },
        {
          "name": "MAP-Ing",
          "description": "Monitoreo de defectos, porosidad y caracterizacion microscopica para materiales de ingenieria y construccion.",
          "category": "ing",
          "keywords": [
            "concrete microstructure",
            "soil microstructure",
            "cementitious materials porosity",
            "crack detection microscopy",
            "materials defects",
            "corrosion surface analysis",
            "coating defect analysis"
          ]
        },
        {
          "name": "General",
          "description": "Temas transversales de automatizacion de laboratorio, vision computacional y AI aplicada a microscopia.",
          "category": "general",
          "keywords": [
            "scientific image analysis",
            "automated microscopy",
            "computer vision microscopy",
            "AI for microscopy",
            "materials informatics",
            "laboratory automation"
          ]
        }
      ]'::jsonb
    )
  loop
    update public.intelligence_topics
    set
      description = left(coalesce(item->>'description', ''), 2000),
      category = coalesce(item->>'category', 'general'),
      keywords = coalesce(
        (
          select array_agg(distinct keyword order by keyword)
          from jsonb_array_elements_text(coalesce(item->'keywords', '[]'::jsonb)) as keywords(keyword)
        ),
        '{}'::text[]
      ),
      enabled = true,
      updated_at = now()
    where lower(name) = lower(item->>'name');

    if not found then
      insert into public.intelligence_topics (
        name,
        description,
        category,
        keywords,
        enabled
      )
      values (
        left(coalesce(item->>'name', ''), 160),
        left(coalesce(item->>'description', ''), 2000),
        coalesce(item->>'category', 'general'),
        coalesce(
          (
            select array_agg(distinct keyword order by keyword)
            from jsonb_array_elements_text(coalesce(item->'keywords', '[]'::jsonb)) as keywords(keyword)
          ),
          '{}'::text[]
        ),
        true
      );
    end if;
  end loop;
end $$;
