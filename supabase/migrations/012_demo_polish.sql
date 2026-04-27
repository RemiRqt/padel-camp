-- ============================================
-- 012_demo_polish : enrichissement données démo
-- ============================================
-- IDEMPOTENT : peut être ré-exécuté sans casser
-- Exécution : Supabase Studio SQL Editor sur le projet volranoojbqeramwldaf
-- Préfixe UUIDs membres démo : a2000000-...
-- Email domain : @demo.padelcamp.test
-- Conserve TOUS les membres existants et en ajoute 10 nouveaux.
-- L'admin réel rranquet@gmail.com est EXCLU des pools de tirage (résas, règlements, recharges, ventes).
-- ============================================

DO $$
DECLARE
  -- 10 nouveaux membres démo, UUIDs fixes pour idempotence
  demo_members UUID[] := ARRAY[
    'a2000000-0000-0000-0000-000000000001'::UUID,
    'a2000000-0000-0000-0000-000000000002'::UUID,
    'a2000000-0000-0000-0000-000000000003'::UUID,
    'a2000000-0000-0000-0000-000000000004'::UUID,
    'a2000000-0000-0000-0000-000000000005'::UUID,
    'a2000000-0000-0000-0000-000000000006'::UUID,
    'a2000000-0000-0000-0000-000000000007'::UUID,
    'a2000000-0000-0000-0000-000000000008'::UUID,
    'a2000000-0000-0000-0000-000000000009'::UUID,
    'a2000000-0000-0000-0000-000000000010'::UUID
  ];
  demo_first_names TEXT[] := ARRAY[
    'Léa','Hugo','Chloé','Nathan','Manon','Enzo','Inès','Tom','Jade','Raphaël'
  ];
  demo_last_names TEXT[] := ARRAY[
    'Lefevre','Mercier','Faure','Andre','Bonnet','Blanc','Guerin','Boyer','Garnier','Chevalier'
  ];
BEGIN
  -- ============================================
  -- 10 nouveaux membres dans auth.users (mot de passe = 'demo2026')
  -- Le trigger handle_new_user crée automatiquement un profile
  -- ============================================
  FOR i IN 1..10 LOOP
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, role, aud, created_at, updated_at, raw_user_meta_data
    )
    VALUES (
      demo_members[i],
      '00000000-0000-0000-0000-000000000000',
      lower(translate(demo_first_names[i], 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC'))
        || '.'
        || lower(translate(demo_last_names[i], 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC'))
        || '@demo.padelcamp.test',
      crypt('demo2026', gen_salt('bf')),
      NOW(),
      'authenticated',
      'authenticated',
      NOW() - (random() * 365)::INT * INTERVAL '1 day',
      NOW(),
      jsonb_build_object('display_name', demo_first_names[i] || ' ' || demo_last_names[i])
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- Mettre à jour les profils avec données démo cohérentes
  -- 9 membres standard + 1 admin démo (en plus des comptes existants)
  FOR i IN 1..10 LOOP
    UPDATE profiles SET
      display_name = demo_first_names[i] || ' ' || demo_last_names[i],
      phone = '+33 6 99 99 ' || lpad(((i*7) % 100)::TEXT, 2, '0') || ' ' || lpad(((i*13) % 100)::TEXT, 2, '0'),
      license_number = '90' || lpad((10000 + i)::TEXT, 5, '0'),
      balance = (50 + (i * 7) % 200)::DECIMAL,
      balance_bonus = ((i * 11) % 50)::DECIMAL,
      role = CASE
        WHEN i = 10 THEN 'admin'::user_role
        ELSE 'user'::user_role
      END
    WHERE id = demo_members[i];
  END LOOP;

  RAISE NOTICE 'Task 3 OK : 10 membres démo créés/mis à jour';
END $$;

-- ============================================
-- Task 4 : réservations avril 2026 (70%) + mai 2026 (dégressif)
-- Pool joueurs = tous les profils sauf rranquet@gmail.com
-- Idempotent : skip si des bookings existent déjà pour les membres a2000000-* sur avril
-- ============================================
DO $$
DECLARE
  all_members UUID[];
  all_names TEXT[];
  courts TEXT[] := ARRAY['terrain_1','terrain_2','terrain_3'];
  slot_starts TIME[] := ARRAY['09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30']::TIME[];
  slot_ends   TIME[] := ARRAY['11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00']::TIME[];
  prices DECIMAL[] := ARRAY[24,24,36,36,36,36,42,42,42];
  d DATE;
  member_idx INT;
  court_idx INT;
  slot_idx INT;
  fill_rate FLOAT;
  week_of_may INT;
  total_inserted INT := 0;
BEGIN
  -- Idempotence : si on a déjà beaucoup de bookings sur avril, skip tout le bloc
  IF (SELECT count(*) FROM bookings WHERE date BETWEEN '2026-04-01' AND '2026-04-30') > 100 THEN
    RAISE NOTICE 'Task 4 SKIP : bookings démo déjà présents (avril déjà rempli)';
    RETURN;
  END IF;

  -- Pool : tous les membres sauf l'admin réel
  SELECT array_agg(id ORDER BY id), array_agg(display_name ORDER BY id)
  INTO all_members, all_names
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  IF array_length(all_members, 1) IS NULL OR array_length(all_members, 1) = 0 THEN
    RAISE EXCEPTION 'Pool de membres vide, abandon';
  END IF;

  -- Avril 2026 : 70% partout
  FOR d IN SELECT generate_series('2026-04-01'::DATE, '2026-04-30'::DATE, '1 day'::INTERVAL)::DATE LOOP
    FOR court_idx IN 1..3 LOOP
      FOR slot_idx IN 1..9 LOOP
        IF random() < 0.70 THEN
          member_idx := floor(random() * array_length(all_members, 1))::INT + 1;
          INSERT INTO bookings (user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
          VALUES (
            all_members[member_idx],
            all_names[member_idx],
            courts[court_idx],
            d,
            slot_starts[slot_idx],
            slot_ends[slot_idx],
            prices[slot_idx],
            'confirmed',
            'pending',
            (d - (random() * 5)::INT)::TIMESTAMPTZ + INTERVAL '14 hours'
          );
          total_inserted := total_inserted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Mai 2026 : dégressif S1=60% S2=45% S3=30% S4=15% (S5 résidu 10%)
  FOR d IN SELECT generate_series('2026-05-01'::DATE, '2026-05-31'::DATE, '1 day'::INTERVAL)::DATE LOOP
    week_of_may := ((EXTRACT(DAY FROM d)::INT - 1) / 7) + 1;
    fill_rate := CASE
      WHEN week_of_may = 1 THEN 0.60
      WHEN week_of_may = 2 THEN 0.45
      WHEN week_of_may = 3 THEN 0.30
      WHEN week_of_may = 4 THEN 0.15
      ELSE 0.10
    END;

    FOR court_idx IN 1..3 LOOP
      FOR slot_idx IN 1..9 LOOP
        IF random() < fill_rate THEN
          member_idx := floor(random() * array_length(all_members, 1))::INT + 1;
          INSERT INTO bookings (user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
          VALUES (
            all_members[member_idx],
            all_names[member_idx],
            courts[court_idx],
            d,
            slot_starts[slot_idx],
            slot_ends[slot_idx],
            prices[slot_idx],
            'confirmed',
            'pending',
            (d - (random() * 5)::INT)::TIMESTAMPTZ + INTERVAL '14 hours'
          );
          total_inserted := total_inserted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Task 4 OK : % bookings insérés (avril 70%% + mai dégressif)', total_inserted;
END $$;

-- ============================================
-- Task 5a : recharges wallet (priming des soldes pour les sessions)
-- ~18 membres tirés au hasard, 1-3 recharges chacun via formules existantes
-- Mix : 60% CB / 40% espèces (l'enum payment_method ne supporte pas 'transfer')
-- Idempotent : skip si transactions de type 'credit' existent déjà sur la période
-- ============================================
DO $$
DECLARE
  recharge_pool UUID[];
  target_member UUID;
  nb_recharges INT;
  formula RECORD;
  pay_method TEXT;
  r FLOAT;
  admin_id UUID;
  v_bonus DECIMAL;
  recharge_ts TIMESTAMPTZ;
  total INT := 0;
BEGIN
  -- Idempotence : skip si on a déjà inséré >20 credit sur la période démo
  IF (SELECT count(*) FROM transactions
      WHERE type = 'credit'
        AND created_at BETWEEN '2026-03-15' AND '2026-04-27') > 20 THEN
    RAISE NOTICE 'Task 5a SKIP : recharges démo déjà présentes';
    RETURN;
  END IF;

  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Aucun admin trouvé pour performed_by';
  END IF;

  -- Tirer 18 membres au hasard hors rranquet
  SELECT array_agg(id) INTO recharge_pool
  FROM (
    SELECT id FROM profiles
    WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com')
    ORDER BY random()
    LIMIT 18
  ) sub;

  FOREACH target_member IN ARRAY recharge_pool LOOP
    nb_recharges := 1 + floor(random() * 3)::INT;  -- 1 à 3
    FOR i IN 1..nb_recharges LOOP
      SELECT amount_paid, amount_credited INTO formula
      FROM recharge_formulas
      WHERE is_active = true
      ORDER BY random()
      LIMIT 1;

      IF formula IS NULL THEN
        RAISE EXCEPTION 'Aucune recharge_formula active trouvée';
      END IF;

      r := random();
      pay_method := CASE WHEN r < 0.60 THEN 'cb' ELSE 'cash' END;

      v_bonus := formula.amount_credited - formula.amount_paid;
      recharge_ts := ('2026-03-15'::DATE + (random() * 40)::INT)::TIMESTAMPTZ + (random() * INTERVAL '12 hours');

      -- 1) UPDATE balance
      UPDATE profiles SET balance = balance + formula.amount_paid WHERE id = target_member;

      -- 2) INSERT transaction de crédit (backdaté)
      INSERT INTO transactions (
        user_id, type, amount, description, performed_by,
        formula_amount_paid, formula_amount_credited, formula_bonus,
        payment_method, created_at
      )
      VALUES (
        target_member, 'credit', formula.amount_paid,
        'Recharge formule (démo)', admin_id,
        CASE WHEN v_bonus > 0 THEN formula.amount_paid END,
        CASE WHEN v_bonus > 0 THEN formula.amount_credited END,
        CASE WHEN v_bonus > 0 THEN v_bonus END,
        pay_method::payment_method, recharge_ts
      );

      -- 3) Si bonus, UPDATE balance_bonus + insert credit_bonus
      IF v_bonus > 0 THEN
        UPDATE profiles SET balance_bonus = balance_bonus + v_bonus WHERE id = target_member;
        INSERT INTO transactions (
          user_id, type, amount, bonus_amount, description, performed_by,
          payment_method, created_at
        )
        VALUES (
          target_member, 'credit_bonus', v_bonus, v_bonus,
          'Bonus formule (' || formula.amount_paid || '€ → ' || formula.amount_credited || '€)',
          admin_id, 'balance', recharge_ts + INTERVAL '1 second'
        );
      END IF;

      total := total + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Task 5a OK : % recharges (60%% CB / 40%% espèces)', total;
END $$;

-- ============================================
-- Task 5b : règlements complets des sessions PASSÉES
-- 4 joueurs par session : J1 = créateur de la résa, J2-4 tirés au hasard
-- Chaque joueur règle sa part (prix / 4) avec un mode au hasard :
--   70% wallet (debit_session, payment_method='balance')
--   20% CB (external_payment, payment_method='cb')
--   10% espèces (external_payment, payment_method='cash')
-- Si solde insuffisant pour wallet → fallback CB
-- Idempotent : skip si booking_players déjà présents sur les bookings démo passés
-- ============================================
DO $$
DECLARE
  bk RECORD;
  pool UUID[];
  pool_names TEXT[];
  admin_id UUID;
  player_ids UUID[];
  player_names TEXT[];
  candidate_idx INT;
  candidate_id UUID;
  i INT;
  share DECIMAL;
  pay_method TEXT;
  r FLOAT;
  bp_payment_status TEXT;
  v_balance DECIMAL;
  v_balance_bonus DECIMAL;
  v_bonus_used DECIMAL;
  v_real_used DECIMAL;
  session_ts TIMESTAMPTZ;
  total_bp INT := 0;
BEGIN
  -- Idempotence : skip si déjà beaucoup de booking_players sur avril
  IF (SELECT count(*) FROM booking_players bp
      JOIN bookings b ON b.id = bp.booking_id
      WHERE b.date BETWEEN '2026-04-01' AND '2026-04-26') > 100 THEN
    RAISE NOTICE 'Task 5b SKIP : règlements démo déjà présents';
    RETURN;
  END IF;

  -- Pool : tous les membres sauf rranquet
  SELECT array_agg(id ORDER BY id), array_agg(display_name ORDER BY id)
  INTO pool, pool_names
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  FOR bk IN
    SELECT b.id, b.user_id, b.user_name, b.price, b.date, b.start_time
    FROM bookings b
    WHERE b.date < CURRENT_DATE
      AND b.date >= '2026-04-01'
      AND NOT EXISTS (SELECT 1 FROM booking_players bp WHERE bp.booking_id = b.id)
    ORDER BY b.date, b.start_time
  LOOP
    share := round(bk.price / 4.0, 2);
    session_ts := bk.date::TIMESTAMPTZ + bk.start_time;

    -- Joueur 1 = créateur de la résa
    player_ids := ARRAY[bk.user_id]::UUID[];
    player_names := ARRAY[bk.user_name]::TEXT[];

    -- Joueurs 2-4 : tirage au hasard parmi le pool, sans doublon
    WHILE array_length(player_ids, 1) < 4 LOOP
      candidate_idx := floor(random() * array_length(pool, 1))::INT + 1;
      candidate_id := pool[candidate_idx];
      IF NOT (candidate_id = ANY(player_ids)) THEN
        player_ids := array_append(player_ids, candidate_id);
        player_names := array_append(player_names, pool_names[candidate_idx]);
      END IF;
    END LOOP;

    -- Chaque joueur règle sa part
    FOR i IN 1..4 LOOP
      r := random();
      IF r < 0.70 THEN
        pay_method := 'balance';
      ELSIF r < 0.90 THEN
        pay_method := 'cb';
      ELSE
        pay_method := 'cash';
      END IF;

      -- Vérif solde wallet, fallback CB si insuffisant
      IF pay_method = 'balance' THEN
        SELECT balance, balance_bonus INTO v_balance, v_balance_bonus
        FROM profiles WHERE id = player_ids[i] FOR UPDATE;
        IF (v_balance + v_balance_bonus) < share THEN
          pay_method := 'cb';  -- fallback
        END IF;
      END IF;

      IF pay_method = 'balance' THEN
        bp_payment_status := 'paid';
        -- Bonus first
        IF v_balance_bonus >= share THEN
          v_bonus_used := share;
          v_real_used := 0;
        ELSE
          v_bonus_used := v_balance_bonus;
          v_real_used := share - v_balance_bonus;
        END IF;

        UPDATE profiles SET
          balance = balance - v_real_used,
          balance_bonus = balance_bonus - v_bonus_used
        WHERE id = player_ids[i];

        INSERT INTO transactions (
          user_id, type, amount, bonus_used, real_used,
          description, performed_by, booking_id, payment_method, parts_count, created_at
        )
        VALUES (
          player_ids[i], 'debit_session', share, v_bonus_used, v_real_used,
          'Part session ' || bk.date::TEXT || ' ' || bk.start_time::TEXT,
          admin_id, bk.id, 'balance', 1, session_ts
        );
      ELSE
        bp_payment_status := 'external';
        -- INSERT direct dans transactions (bypass RPC qui exige is_admin())
        INSERT INTO transactions (
          user_id, type, amount, description, performed_by, booking_id,
          payment_method, parts_count, created_at
        )
        VALUES (
          player_ids[i], 'external_payment', share,
          'Part session ' || bk.date::TEXT || ' ' || bk.start_time::TEXT,
          admin_id, bk.id, pay_method::payment_method, 1, session_ts
        );
      END IF;

      INSERT INTO booking_players (
        booking_id, user_id, player_name, parts, payment_method, amount, payment_status, created_at
      )
      VALUES (
        bk.id, player_ids[i], player_names[i], 1,
        pay_method::payment_method, share, bp_payment_status,
        session_ts - INTERVAL '1 hour'
      );

      total_bp := total_bp + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Task 5b OK : % booking_players réglés (4 par session passée)', total_bp;
END $$;

-- ============================================
-- Task 5c : FIX prix + RESET règlements + créateur sur résas futures
-- 1) Rembourse les wallets pour les debit_session démo
-- 2) Supprime booking_players + transactions de session démo
-- 3) Recalcule bookings.price selon pricing_rules
--    (Lun-Ven 09:30-17:59 = 52€, sinon 68€)
-- 4) Re-traite les sessions passées avec les bons prix
-- 5) Insère 1 booking_player (créateur) sur chaque résa future, payment_status='pending'
-- ============================================
DO $$
DECLARE
  bk RECORD;
  pool UUID[];
  pool_names TEXT[];
  admin_id UUID;
  player_ids UUID[];
  player_names TEXT[];
  candidate_idx INT;
  candidate_id UUID;
  i INT;
  share DECIMAL;
  pay_method TEXT;
  r FLOAT;
  bp_payment_status TEXT;
  v_balance DECIMAL;
  v_balance_bonus DECIMAL;
  v_bonus_used DECIMAL;
  v_real_used DECIMAL;
  session_ts TIMESTAMPTZ;
  total_bp INT := 0;
  future_inserted INT := 0;
BEGIN
  -- 1) REFUND wallets : pour chaque debit_session démo, restaurer real_used + bonus_used
  WITH refund AS (
    SELECT user_id,
           SUM(real_used) AS r_used,
           SUM(bonus_used) AS b_used
    FROM transactions
    WHERE type = 'debit_session'
      AND created_at BETWEEN '2026-04-01' AND '2026-05-31'
    GROUP BY user_id
  )
  UPDATE profiles p
  SET balance = p.balance + r.r_used,
      balance_bonus = p.balance_bonus + r.b_used
  FROM refund r
  WHERE p.id = r.user_id;

  -- 2) Supprimer transactions de session démo (debit_session + external_payment liées à bookings démo)
  DELETE FROM transactions
  WHERE type IN ('debit_session', 'external_payment')
    AND booking_id IN (
      SELECT id FROM bookings WHERE date BETWEEN '2026-04-01' AND '2026-05-31'
    );

  -- 3) Supprimer booking_players des résas démo
  DELETE FROM booking_players
  WHERE booking_id IN (
    SELECT id FROM bookings WHERE date BETWEEN '2026-04-01' AND '2026-05-31'
  );

  -- 4) Recalculer bookings.price selon pricing_rules
  -- Convention club : 0=Lun..6=Dim → conversion depuis PG DOW (0=Dim) : (DOW + 6) % 7
  UPDATE bookings SET price = CASE
    WHEN ((EXTRACT(DOW FROM date)::INT + 6) % 7) IN (0,1,2,3,4) AND start_time < '18:00'::TIME THEN 52.00
    WHEN ((EXTRACT(DOW FROM date)::INT + 6) % 7) IN (0,1,2,3,4) AND start_time >= '18:00'::TIME THEN 68.00
    ELSE 68.00  -- week-end (5=Sam, 6=Dim) toute la journée
  END
  WHERE date BETWEEN '2026-04-01' AND '2026-05-31';

  -- 5) Re-traiter les sessions PASSÉES (4 joueurs, règlements 70/20/10 avec fallback CB)
  SELECT array_agg(id ORDER BY id), array_agg(display_name ORDER BY id)
  INTO pool, pool_names
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  FOR bk IN
    SELECT b.id, b.user_id, b.user_name, b.price, b.date, b.start_time
    FROM bookings b
    WHERE b.date < CURRENT_DATE
      AND b.date >= '2026-04-01'
    ORDER BY b.date, b.start_time
  LOOP
    share := round(bk.price / 4.0, 2);
    session_ts := bk.date::TIMESTAMPTZ + bk.start_time;

    -- J1 = créateur, J2-4 = aléatoires distincts
    player_ids := ARRAY[bk.user_id]::UUID[];
    player_names := ARRAY[bk.user_name]::TEXT[];
    WHILE array_length(player_ids, 1) < 4 LOOP
      candidate_idx := floor(random() * array_length(pool, 1))::INT + 1;
      candidate_id := pool[candidate_idx];
      IF NOT (candidate_id = ANY(player_ids)) THEN
        player_ids := array_append(player_ids, candidate_id);
        player_names := array_append(player_names, pool_names[candidate_idx]);
      END IF;
    END LOOP;

    FOR i IN 1..4 LOOP
      r := random();
      IF r < 0.70 THEN pay_method := 'balance';
      ELSIF r < 0.90 THEN pay_method := 'cb';
      ELSE pay_method := 'cash';
      END IF;

      IF pay_method = 'balance' THEN
        SELECT balance, balance_bonus INTO v_balance, v_balance_bonus
        FROM profiles WHERE id = player_ids[i] FOR UPDATE;
        IF (v_balance + v_balance_bonus) < share THEN
          pay_method := 'cb';  -- fallback
        END IF;
      END IF;

      IF pay_method = 'balance' THEN
        bp_payment_status := 'paid';
        IF v_balance_bonus >= share THEN
          v_bonus_used := share; v_real_used := 0;
        ELSE
          v_bonus_used := v_balance_bonus; v_real_used := share - v_balance_bonus;
        END IF;
        UPDATE profiles SET
          balance = balance - v_real_used,
          balance_bonus = balance_bonus - v_bonus_used
        WHERE id = player_ids[i];

        INSERT INTO transactions (
          user_id, type, amount, bonus_used, real_used,
          description, performed_by, booking_id, payment_method, parts_count, created_at
        ) VALUES (
          player_ids[i], 'debit_session', share, v_bonus_used, v_real_used,
          'Part session ' || bk.date::TEXT || ' ' || bk.start_time::TEXT,
          admin_id, bk.id, 'balance', 1, session_ts
        );
      ELSE
        bp_payment_status := 'external';
        INSERT INTO transactions (
          user_id, type, amount, description, performed_by, booking_id,
          payment_method, parts_count, created_at
        ) VALUES (
          player_ids[i], 'external_payment', share,
          'Part session ' || bk.date::TEXT || ' ' || bk.start_time::TEXT,
          admin_id, bk.id, pay_method::payment_method, 1, session_ts
        );
      END IF;

      INSERT INTO booking_players (
        booking_id, user_id, player_name, parts, payment_method, amount, payment_status, created_at
      ) VALUES (
        bk.id, player_ids[i], player_names[i], 1,
        pay_method::payment_method, share, bp_payment_status,
        session_ts - INTERVAL '1 hour'
      );
      total_bp := total_bp + 1;
    END LOOP;
  END LOOP;

  -- 6) FUTUR : insérer 1 booking_player (le créateur, pending) pour chaque résa à venir
  -- amount = price / 4 (la part) pour permettre à l'admin de valider sans retaper le montant
  INSERT INTO booking_players (
    booking_id, user_id, player_name, parts, payment_method, amount, payment_status, created_at
  )
  SELECT b.id, b.user_id, b.user_name, 1, 'balance'::payment_method,
         round(b.price / 4.0, 2), 'pending', b.created_at
  FROM bookings b
  WHERE b.date >= CURRENT_DATE
    AND b.date BETWEEN '2026-04-01' AND '2026-05-31'
    AND NOT EXISTS (SELECT 1 FROM booking_players bp WHERE bp.booking_id = b.id);

  GET DIAGNOSTICS future_inserted = ROW_COUNT;

  RAISE NOTICE 'Task 5c OK : prix corrigés, % booking_players passés re-créés, % créateurs ajoutés sur résas futures',
    total_bp, future_inserted;
END $$;

-- ============================================
-- Task 6 : ventes POS sur la période passée (2-5 ventes/jour)
-- Mix paiement : 60% wallet / 25% CB / 15% cash (avec fallback CB si solde insuffisant)
-- Idempotent : skip si déjà beaucoup de transactions de type debit_product sur la période
-- ============================================
DO $$
DECLARE
  d DATE;
  nb_sales INT;
  prod RECORD;
  pool UUID[];
  buyer_id UUID;
  qty INT;
  total_amt DECIMAL;
  pay_method TEXT;
  r FLOAT;
  v_balance DECIMAL;
  v_balance_bonus DECIMAL;
  v_bonus_used DECIMAL;
  v_real_used DECIMAL;
  sale_ts TIMESTAMPTZ;
  admin_id UUID;
  total INT := 0;
BEGIN
  IF (SELECT count(*) FROM transactions
      WHERE type = 'debit_product'
        AND created_at BETWEEN '2026-04-01' AND '2026-04-27') > 30 THEN
    RAISE NOTICE 'Task 6 SKIP : ventes POS démo déjà présentes';
    RETURN;
  END IF;

  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  SELECT array_agg(id) INTO pool
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  FOR d IN SELECT generate_series('2026-04-01'::DATE, (CURRENT_DATE - 1)::DATE, '1 day'::INTERVAL)::DATE LOOP
    nb_sales := 2 + floor(random() * 4)::INT;  -- 2 à 5
    FOR i IN 1..nb_sales LOOP
      SELECT id, name, price INTO prod
      FROM products
      WHERE is_active = true
      ORDER BY random()
      LIMIT 1;

      IF prod IS NULL THEN
        RAISE EXCEPTION 'Aucun produit actif trouvé';
      END IF;

      qty := 1 + floor(random() * 2)::INT;  -- 1 ou 2
      total_amt := prod.price * qty;
      buyer_id := pool[floor(random() * array_length(pool, 1))::INT + 1];
      sale_ts := d::TIMESTAMPTZ + (8 + random() * 14) * INTERVAL '1 hour';  -- entre 8h et 22h

      r := random();
      IF r < 0.60 THEN pay_method := 'balance';
      ELSIF r < 0.85 THEN pay_method := 'cb';
      ELSE pay_method := 'cash';
      END IF;

      IF pay_method = 'balance' THEN
        SELECT balance, balance_bonus INTO v_balance, v_balance_bonus
        FROM profiles WHERE id = buyer_id FOR UPDATE;
        IF (v_balance + v_balance_bonus) < total_amt THEN
          pay_method := 'cb';  -- fallback
        END IF;
      END IF;

      IF pay_method = 'balance' THEN
        IF v_balance_bonus >= total_amt THEN
          v_bonus_used := total_amt; v_real_used := 0;
        ELSE
          v_bonus_used := v_balance_bonus; v_real_used := total_amt - v_balance_bonus;
        END IF;
        UPDATE profiles SET
          balance = balance - v_real_used,
          balance_bonus = balance_bonus - v_bonus_used
        WHERE id = buyer_id;

        INSERT INTO transactions (
          user_id, type, amount, bonus_used, real_used,
          description, performed_by, product_id, payment_method, parts_count, created_at
        ) VALUES (
          buyer_id, 'debit_product', total_amt, v_bonus_used, v_real_used,
          qty || 'x ' || prod.name, admin_id, prod.id, 'balance', qty, sale_ts
        );
      ELSE
        INSERT INTO transactions (
          user_id, type, amount, description, performed_by, product_id,
          payment_method, parts_count, created_at
        ) VALUES (
          buyer_id, 'external_payment', total_amt,
          qty || 'x ' || prod.name, admin_id, prod.id,
          pay_method::payment_method, qty, sale_ts
        );
      END IF;

      total := total + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Task 6 OK : % ventes POS sur la période', total;
END $$;

-- ============================================
-- Task 7 : diversifier les TVA (5.5 / 10 / 20)
-- + recompute TVA sur transactions POS existantes
-- ============================================

-- Boissons + Location → 10% (restauration sur place / service)
UPDATE product_categories SET tva_rate = 10
WHERE name IN ('Boissons', 'Location');

-- Override 5.5% sur eau et jus (alimentaire de base)
UPDATE products SET tva_rate = 5.5
WHERE name ILIKE '%eau%' OR name ILIKE '%jus%';

-- Recompute TVA sur transactions POS existantes
UPDATE transactions t
SET tva_rate = effective.rate,
    amount_ht = ROUND(t.amount / (1 + effective.rate/100), 2),
    amount_tva = t.amount - ROUND(t.amount / (1 + effective.rate/100), 2)
FROM (
  SELECT p.id AS product_id,
         COALESCE(p.tva_rate, c.tva_rate, 20) AS rate
  FROM products p
  LEFT JOIN product_categories c ON c.id = p.category_id
) effective
WHERE t.product_id = effective.product_id
  AND t.type IN ('debit_product', 'external_payment')
  AND t.product_id IS NOT NULL;
