-- ============================================
-- 014_demo_tournament_registrations
-- ============================================
-- Inscriptions aléatoires sur les 3 prochains tournois pour la démo :
--   Tournoi 1 (le plus proche) : COMPLET (max_teams approved) + 3 en waitlist
--   Tournoi 2                  : ~60% du max_teams en approved + 1-2 pending_admin
--   Tournoi 3                  : ~30% du max_teams en approved
-- Pool joueurs : tous les profils avec license_number, hors rranquet@gmail.com.
-- Idempotent : skip si des inscriptions existent déjà sur ces tournois.
-- ============================================

DO $$
DECLARE
  t1 RECORD;  -- tournoi plein
  t2 RECORD;  -- tournoi à moitié
  t3 RECORD;  -- tournoi peu rempli
  pool_uid UUID[];
  pool_name TEXT[];
  pool_lic TEXT[];
  pool_size INT;
  i INT;
  j INT;
  p1_idx INT;
  p2_idx INT;
  is_external BOOLEAN;
  fill_count INT;
  external_first_names TEXT[] := ARRAY['Karim','Sofia','Bruno','Camille','Yannick','Elsa','Marc','Julie'];
  external_last_names  TEXT[] := ARRAY['Toumi','Petit','Roy','Vincent','Schmitt','Brun','Carre','Renard'];
BEGIN
  -- Sélection des 3 prochains tournois (ouverts ou pleins, à venir)
  SELECT id, max_teams INTO t1
  FROM tournaments
  WHERE date >= CURRENT_DATE AND status IN ('open', 'full', 'closed')
  ORDER BY date ASC, start_time ASC
  LIMIT 1 OFFSET 0;

  SELECT id, max_teams INTO t2
  FROM tournaments
  WHERE date >= CURRENT_DATE AND status IN ('open', 'full', 'closed')
  ORDER BY date ASC, start_time ASC
  LIMIT 1 OFFSET 1;

  SELECT id, max_teams INTO t3
  FROM tournaments
  WHERE date >= CURRENT_DATE AND status IN ('open', 'full', 'closed')
  ORDER BY date ASC, start_time ASC
  LIMIT 1 OFFSET 2;

  IF t1.id IS NULL THEN
    RAISE NOTICE 'Aucun tournoi à venir trouvé, abandon';
    RETURN;
  END IF;

  -- Idempotence : skip si l'un des 3 tournois a déjà des inscriptions
  IF EXISTS (
    SELECT 1 FROM tournament_registrations
    WHERE tournament_id IN (t1.id, COALESCE(t2.id, t1.id), COALESCE(t3.id, t1.id))
  ) THEN
    RAISE NOTICE 'Inscriptions déjà présentes sur les tournois ciblés, skip';
    RETURN;
  END IF;

  -- Pool joueurs : profils avec license, hors admin réel
  SELECT array_agg(p.id), array_agg(p.display_name), array_agg(p.license_number)
  INTO pool_uid, pool_name, pool_lic
  FROM profiles p
  WHERE p.license_number IS NOT NULL
    AND p.id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  pool_size := COALESCE(array_length(pool_uid, 1), 0);
  IF pool_size < 4 THEN
    RAISE EXCEPTION 'Pool de joueurs trop petit (%) pour seeder des inscriptions', pool_size;
  END IF;

  -- =========================================
  -- TOURNOI 1 : COMPLET + waitlist
  -- =========================================
  fill_count := t1.max_teams;
  FOR i IN 1..fill_count LOOP
    LOOP p1_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p1_idx BETWEEN 1 AND pool_size; END LOOP;
    LOOP p2_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p2_idx != p1_idx; END LOOP;

    is_external := random() < 0.20;
    IF is_external THEN
      INSERT INTO tournament_registrations (
        tournament_id, player1_uid, player1_name, player1_license,
        player2_uid, player2_name, player2_license, player2_is_external,
        status, player1_confirmed, player2_confirmed, admin_validated
      ) VALUES (
        t1.id, pool_uid[p1_idx], pool_name[p1_idx], pool_lic[p1_idx],
        NULL,
        external_first_names[1 + (i % 8)] || ' ' || external_last_names[1 + ((i*3) % 8)],
        '90' || lpad((50000 + i)::TEXT, 5, '0'),
        true,
        'approved', true, true, true
      );
    ELSE
      INSERT INTO tournament_registrations (
        tournament_id, player1_uid, player1_name, player1_license,
        player2_uid, player2_name, player2_license, player2_is_external,
        status, player1_confirmed, player2_confirmed, admin_validated
      ) VALUES (
        t1.id, pool_uid[p1_idx], pool_name[p1_idx], pool_lic[p1_idx],
        pool_uid[p2_idx], pool_name[p2_idx], pool_lic[p2_idx], false,
        'approved', true, true, true
      );
    END IF;
  END LOOP;

  -- 3 paires en waitlist
  FOR i IN 1..3 LOOP
    LOOP p1_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p1_idx BETWEEN 1 AND pool_size; END LOOP;
    LOOP p2_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p2_idx != p1_idx; END LOOP;

    INSERT INTO tournament_registrations (
      tournament_id, player1_uid, player1_name, player1_license,
      player2_uid, player2_name, player2_license, player2_is_external,
      status, position, player1_confirmed, player2_confirmed, admin_validated
    ) VALUES (
      t1.id, pool_uid[p1_idx], pool_name[p1_idx], pool_lic[p1_idx],
      pool_uid[p2_idx], pool_name[p2_idx], pool_lic[p2_idx], false,
      'waitlist', i, false, false, false
    );
  END LOOP;

  -- Mettre à jour le statut du tournoi à 'full'
  UPDATE tournaments SET status = 'full' WHERE id = t1.id;

  -- =========================================
  -- TOURNOI 2 : ~60% du max_teams approved + 2 pending_admin
  -- =========================================
  IF t2.id IS NOT NULL THEN
    fill_count := GREATEST(2, (t2.max_teams * 6 / 10)::INT);
    FOR i IN 1..fill_count LOOP
      LOOP p1_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p1_idx BETWEEN 1 AND pool_size; END LOOP;
      LOOP p2_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p2_idx != p1_idx; END LOOP;

      INSERT INTO tournament_registrations (
        tournament_id, player1_uid, player1_name, player1_license,
        player2_uid, player2_name, player2_license, player2_is_external,
        status, player1_confirmed, player2_confirmed, admin_validated
      ) VALUES (
        t2.id, pool_uid[p1_idx], pool_name[p1_idx], pool_lic[p1_idx],
        pool_uid[p2_idx], pool_name[p2_idx], pool_lic[p2_idx], false,
        'approved', random() < 0.5, random() < 0.5, true
      );
    END LOOP;

    -- 2 pending_admin
    FOR i IN 1..2 LOOP
      LOOP p1_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p1_idx BETWEEN 1 AND pool_size; END LOOP;
      LOOP p2_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p2_idx != p1_idx; END LOOP;

      INSERT INTO tournament_registrations (
        tournament_id, player1_uid, player1_name, player1_license,
        player2_uid, player2_name, player2_license, player2_is_external,
        status, player1_confirmed, player2_confirmed, admin_validated
      ) VALUES (
        t2.id, pool_uid[p1_idx], pool_name[p1_idx], pool_lic[p1_idx],
        pool_uid[p2_idx], pool_name[p2_idx], pool_lic[p2_idx], false,
        'pending_admin', false, false, false
      );
    END LOOP;
  END IF;

  -- =========================================
  -- TOURNOI 3 : ~30% du max_teams approved
  -- =========================================
  IF t3.id IS NOT NULL THEN
    fill_count := GREATEST(1, (t3.max_teams * 3 / 10)::INT);
    FOR i IN 1..fill_count LOOP
      LOOP p1_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p1_idx BETWEEN 1 AND pool_size; END LOOP;
      LOOP p2_idx := floor(random() * pool_size)::INT + 1; EXIT WHEN p2_idx != p1_idx; END LOOP;

      INSERT INTO tournament_registrations (
        tournament_id, player1_uid, player1_name, player1_license,
        player2_uid, player2_name, player2_license, player2_is_external,
        status, player1_confirmed, player2_confirmed, admin_validated
      ) VALUES (
        t3.id, pool_uid[p1_idx], pool_name[p1_idx], pool_lic[p1_idx],
        pool_uid[p2_idx], pool_name[p2_idx], pool_lic[p2_idx], false,
        'approved', false, false, true
      );
    END LOOP;
  END IF;

  RAISE NOTICE 'Task 7 OK : inscriptions seedées sur les 3 prochains tournois';
END $$;
