UPDATE samples SET metric = 'energy_total' WHERE metric = 'energy';

UPDATE daily_rollups SET metric = 'energy_total'
WHERE metric = 'energy'
  AND NOT EXISTS (
    SELECT 1 FROM daily_rollups other
    WHERE other.user_id = daily_rollups.user_id
      AND other.metric = 'energy_total'
      AND other.day = daily_rollups.day
  );

DELETE FROM daily_rollups WHERE metric = 'energy';
