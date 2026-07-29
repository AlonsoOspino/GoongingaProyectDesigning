UPDATE "FamilyFeudGame"
SET
  "phase" = CASE
    WHEN "state"->'round'->>'phase' = 'question' THEN 'choosingParticipant'
    WHEN "state"->'round'->>'phase' IN ('faceoff', 'control', 'steal') THEN 'playing'
    WHEN "state"->'round'->>'phase' = 'round-over' THEN 'roundComplete'
    WHEN COALESCE(("state"->>'gameStarted')::boolean, false) THEN 'teamLobby'
    ELSE 'notStarted'
  END,
  "round" = CASE
    WHEN COALESCE(("state"->'round'->>'number')::integer, 0) > 0
      THEN ("state"->'round'->>'number')::integer
    ELSE NULL
  END;
