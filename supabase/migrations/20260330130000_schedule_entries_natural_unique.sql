-- Remove linhas duplicadas (mesmo trecho/atividade no mesmo roster) e impede novas duplicidades.
-- Mantém o registro mais antigo (created_at ASC, id ASC).

DELETE FROM public.schedule_entries se
WHERE se.id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY
          roster_id,
          user_id,
          date,
          upper(trim(flight_number)),
          left(btrim(coalesce(departure_time, '00:00')), 5),
          left(btrim(coalesce(arrival_time, '00:00')), 5),
          upper(trim(departure)),
          upper(trim(arrival)),
          is_flight,
          activity_type
        ORDER BY created_at ASC NULLS LAST, id ASC
      ) AS rn
    FROM public.schedule_entries
  ) dup
  WHERE dup.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS schedule_entries_natural_leg_uniq
  ON public.schedule_entries (
    roster_id,
    user_id,
    date,
    upper(trim(flight_number)),
    left(btrim(coalesce(departure_time, '00:00')), 5),
    left(btrim(coalesce(arrival_time, '00:00')), 5),
    upper(trim(departure)),
    upper(trim(arrival)),
    is_flight,
    activity_type
  );

COMMENT ON INDEX public.schedule_entries_natural_leg_uniq IS
  'Um trecho/atividade por roster: evita inflação de horas por linhas duplicadas.';
