-- ============================================
-- 017_demo_april_clean_rebuild
-- ============================================
-- Reset complet de la démo sur avril 2026 :
--   1) Rembourse les wallets pour tous les debit_session / debit_product d'avril
--   2) Supprime les transactions de session/article/external d'avril
--   3) Supprime les booking_players des bookings d'avril
--   4) Supprime les bookings d'avril
--   5) Prime les wallets : chaque membre est crédité fin mars pour
--      atteindre un solde minimum confortable (≥ 280 €). Une transaction
--      credit (formule, payment_method CB ou cash) est créée pour chaque
--      recharge afin que le rapport financier reste cohérent.
--   6) Régénère les bookings du 1er au 28 avril en évitant les
--      créneaux bloqués par tournois/événements
--   7) Règle les sessions (4 joueurs/résa, mix wallet 85 / CB 10 / cash 5
--      avec fallback CB si solde insuffisant) avec les vrais prix
--   8) Génère 2-5 ventes POS par jour (mix wallet 75 / CB 15 / cash 10)
--   9) Recalcule la TVA sur les ventes POS
--
-- Idempotent : peut être ré-exécuté sans risque (wipe + rebuild).
-- Ne touche ni aux recharges (transactions credit), ni aux tournois,
-- ni aux événements, ni aux profils sauf via les remboursements.
-- ============================================

-- =========================================
-- ÉTAPE 1 : refund + wipe
-- =========================================
DO $$
DECLARE
  refunded_users INT := 0;
  deleted_tx     INT := 0;
  deleted_bp     INT := 0;
  deleted_bk     INT := 0;
BEGIN
  -- Refund wallets (debit_session + debit_product avril)
  WITH refund AS (
    SELECT user_id,
           COALESCE(SUM(real_used), 0)  AS r_used,
           COALESCE(SUM(bonus_used), 0) AS b_used
    FROM transactions
    WHERE type IN ('debit_session', 'debit_product')
      AND created_at >= '2026-04-01'::TIMESTAMPTZ
      AND created_at <  '2026-04-29'::TIMESTAMPTZ
      AND user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE profiles p
  SET balance       = p.balance       + r.r_used,
      balance_bonus = p.balance_bonus + r.b_used
  FROM refund r
  WHERE p.id = r.user_id;
  GET DIAGNOSTICS refunded_users = ROW_COUNT;

  -- Supprimer transactions session/article/external d'avril
  DELETE FROM transactions
  WHERE type IN ('debit_session', 'debit_product', 'external_payment')
    AND created_at >= '2026-04-01'::TIMESTAMPTZ
    AND created_at <  '2026-04-29'::TIMESTAMPTZ;
  GET DIAGNOSTICS deleted_tx = ROW_COUNT;

  -- Supprimer booking_players des bookings d'avril
  DELETE FROM booking_players
  WHERE booking_id IN (
    SELECT id FROM bookings WHERE date BETWEEN '2026-04-01' AND '2026-04-28'
  );
  GET DIAGNOSTICS deleted_bp = ROW_COUNT;

  -- Supprimer les bookings d'avril
  DELETE FROM bookings
  WHERE date BETWEEN '2026-04-01' AND '2026-04-28';
  GET DIAGNOSTICS deleted_bk = ROW_COUNT;

  RAISE NOTICE 'Étape 1 OK : % wallets recrédités, % tx supprimées, % bp supprimés, % bookings supprimés',
    refunded_users, deleted_tx, deleted_bp, deleted_bk;
END $$;

-- =========================================
-- ÉTAPE 1.5 : prime wallets — chaque membre atteint ≥ 280 € avant le 1er avril
-- Une transaction credit (formule) est créée pour chaque recharge,
-- payment_method CB (70 %) ou espèces (30 %), datée fin mars.
-- =========================================
DO $$
DECLARE
  m            RECORD;
  admin_id     UUID;
  current_bal  DECIMAL;
  needed       DECIMAL;
  amount_paid  DECIMAL;
  amount_credited DECIMAL;
  bonus_amount DECIMAL;
  pay_method   TEXT;
  recharge_ts  TIMESTAMPTZ;
  primed_count INT := 0;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  FOR m IN
    SELECT id, balance, balance_bonus
    FROM profiles
    WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com')
  LOOP
    current_bal := m.balance + m.balance_bonus;
    IF current_bal >= 280 THEN
      CONTINUE;
    END IF;

    needed := 280 - current_bal;

    -- Choix de la formule (paid → credited avec bonus) :
    --   < 60 € manquant : 100 € payés → 110 € crédités (bonus 10 %)
    --   60-150 € manquant : 200 € payés → 230 € crédités (bonus 15 %)
    --   > 150 € manquant : 300 € payés → 360 € crédités (bonus 20 %)
    IF needed < 60 THEN
      amount_paid := 100; amount_credited := 110;
    ELSIF needed < 150 THEN
      amount_paid := 200; amount_credited := 230;
    ELSE
      amount_paid := 300; amount_credited := 360;
    END IF;
    bonus_amount := amount_credited - amount_paid;

    -- 70 % CB, 30 % cash
    IF random() < 0.70 THEN
      pay_method := 'cb';
    ELSE
      pay_method := 'cash';
    END IF;

    recharge_ts := '2026-03-25'::TIMESTAMPTZ + (random() * 6)::INT * INTERVAL '1 day'
                   + (random() * 12 + 9)::INT * INTERVAL '1 hour';

    -- Crédite : montant_payé sur balance, bonus sur balance_bonus
    UPDATE profiles
    SET balance       = balance       + amount_paid,
        balance_bonus = balance_bonus + bonus_amount
    WHERE id = m.id;

    -- Transaction credit (recharge wallet via formule)
    INSERT INTO transactions (
      user_id, type, amount, bonus_amount, description,
      performed_by, payment_method,
      formula_amount_paid, formula_amount_credited, formula_bonus,
      created_at
    ) VALUES (
      m.id, 'credit', amount_paid, bonus_amount,
      'Recharge wallet (' || amount_paid::TEXT || ' € → ' || amount_credited::TEXT || ' €)',
      admin_id, pay_method::payment_method,
      amount_paid, amount_credited, bonus_amount,
      recharge_ts
    );

    primed_count := primed_count + 1;
  END LOOP;

  RAISE NOTICE 'Étape 1.5 OK : % wallets primés (≥ 280 € avant avril)', primed_count;
END $$;

-- =========================================
-- ÉTAPE 2 : régénérer les bookings + règlements
-- =========================================
DO $$
DECLARE
  pool       UUID[];
  pool_names TEXT[];
  pool_size  INT;
  admin_id   UUID;

  courts      TEXT[] := ARRAY['terrain_1','terrain_2','terrain_3'];
  slot_starts TIME[] := ARRAY['09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30']::TIME[];
  slot_ends   TIME[] := ARRAY['11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00']::TIME[];

  d            DATE;
  court_idx    INT;
  slot_idx     INT;
  s_start      TIME;
  s_end        TIME;
  is_blocked   BOOLEAN;
  dow          INT;
  s_price      DECIMAL;

  member_idx   INT;
  bk_id        UUID;
  bk_user      UUID;
  bk_user_name TEXT;
  session_ts   TIMESTAMPTZ;

  player_ids   UUID[];
  player_names TEXT[];
  cand_idx     INT;
  cand_id      UUID;
  i            INT;
  share        DECIMAL;
  pay_method   TEXT;
  r            FLOAT;
  bp_status    TEXT;
  v_bal        DECIMAL;
  v_bonus      DECIMAL;
  v_bonus_used DECIMAL;
  v_real_used  DECIMAL;

  bookings_created INT := 0;
  settlements      INT := 0;
BEGIN
  -- Pool de membres (hors admin réel)
  SELECT array_agg(id ORDER BY id), array_agg(display_name ORDER BY id)
  INTO pool, pool_names
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  pool_size := COALESCE(array_length(pool, 1), 0);
  IF pool_size < 4 THEN
    RAISE EXCEPTION 'Pool de joueurs insuffisant (%) pour régénérer les sessions', pool_size;
  END IF;

  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  FOR d IN SELECT generate_series('2026-04-01'::DATE, '2026-04-28'::DATE, '1 day'::INTERVAL)::DATE LOOP
    -- Convention club : 0=Lun..6=Dim → conversion DOW Postgres (0=Dim) : (DOW + 6) % 7
    dow := ((EXTRACT(DOW FROM d)::INT + 6) % 7);

    FOR court_idx IN 1..3 LOOP
      FOR slot_idx IN 1..9 LOOP
        s_start := slot_starts[slot_idx];
        s_end   := slot_ends[slot_idx];

        -- Créneau bloqué par un tournoi (≠ cancelled) ou un événement ?
        SELECT EXISTS (
          SELECT 1 FROM tournaments t
          WHERE t.date = d AND t.status <> 'cancelled'
            AND s_start < t.end_time AND s_end > t.start_time
          UNION ALL
          SELECT 1 FROM events e
          WHERE e.date = d
            AND s_start < e.end_time AND s_end > e.start_time
        ) INTO is_blocked;

        CONTINUE WHEN is_blocked;

        -- Taux de remplissage 65%
        IF random() >= 0.65 THEN
          CONTINUE;
        END IF;

        -- Prix selon pricing : Lun-Ven < 18h = 52€, sinon 68€
        IF dow IN (0,1,2,3,4) AND s_start < '18:00'::TIME THEN
          s_price := 52.00;
        ELSE
          s_price := 68.00;
        END IF;

        member_idx := floor(random() * pool_size)::INT + 1;
        bk_user      := pool[member_idx];
        bk_user_name := pool_names[member_idx];
        session_ts   := d::TIMESTAMPTZ + s_start;

        INSERT INTO bookings (
          user_id, user_name, court_id, date, start_time, end_time,
          price, status, payment_status, created_at
        ) VALUES (
          bk_user, bk_user_name, courts[court_idx], d, s_start, s_end,
          s_price, 'confirmed', 'pending',
          (d - (random() * 5)::INT)::TIMESTAMPTZ + INTERVAL '14 hours'
        ) RETURNING id INTO bk_id;
        bookings_created := bookings_created + 1;

        -- Règlements : 4 joueurs (créateur + 3 aléatoires)
        share := round(s_price / 4.0, 2);
        player_ids   := ARRAY[bk_user]::UUID[];
        player_names := ARRAY[bk_user_name]::TEXT[];
        WHILE array_length(player_ids, 1) < 4 LOOP
          cand_idx := floor(random() * pool_size)::INT + 1;
          cand_id  := pool[cand_idx];
          IF NOT (cand_id = ANY(player_ids)) THEN
            player_ids   := array_append(player_ids,   cand_id);
            player_names := array_append(player_names, pool_names[cand_idx]);
          END IF;
        END LOOP;

        FOR i IN 1..4 LOOP
          r := random();
          IF r < 0.85 THEN pay_method := 'balance';
          ELSIF r < 0.95 THEN pay_method := 'cb';
          ELSE pay_method := 'cash';
          END IF;

          IF pay_method = 'balance' THEN
            SELECT balance, balance_bonus INTO v_bal, v_bonus
            FROM profiles WHERE id = player_ids[i] FOR UPDATE;
            IF (v_bal + v_bonus) < share THEN
              pay_method := 'cb';  -- fallback
            END IF;
          END IF;

          IF pay_method = 'balance' THEN
            bp_status := 'paid';
            IF v_bonus >= share THEN
              v_bonus_used := share; v_real_used := 0;
            ELSE
              v_bonus_used := v_bonus; v_real_used := share - v_bonus;
            END IF;
            UPDATE profiles SET
              balance       = balance       - v_real_used,
              balance_bonus = balance_bonus - v_bonus_used
            WHERE id = player_ids[i];

            INSERT INTO transactions (
              user_id, type, amount, bonus_used, real_used,
              description, performed_by, booking_id, payment_method, parts_count, created_at
            ) VALUES (
              player_ids[i], 'debit_session', share, v_bonus_used, v_real_used,
              'Part session ' || d::TEXT || ' ' || s_start::TEXT,
              admin_id, bk_id, 'balance', 1, session_ts
            );
          ELSE
            bp_status := 'external';
            INSERT INTO transactions (
              user_id, type, amount, description, performed_by, booking_id,
              payment_method, parts_count, created_at
            ) VALUES (
              player_ids[i], 'external_payment', share,
              'Part session ' || d::TEXT || ' ' || s_start::TEXT,
              admin_id, bk_id, pay_method::payment_method, 1, session_ts
            );
          END IF;

          INSERT INTO booking_players (
            booking_id, user_id, player_name, parts, payment_method, amount, payment_status, created_at
          ) VALUES (
            bk_id, player_ids[i], player_names[i], 1,
            pay_method::payment_method, share, bp_status,
            session_ts - INTERVAL '1 hour'
          );
          settlements := settlements + 1;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Étape 2 OK : % bookings créés, % règlements posés', bookings_created, settlements;
END $$;

-- =========================================
-- ÉTAPE 3 : ventes POS quotidiennes (2-5/jour, 1-28 avril)
-- =========================================
DO $$
DECLARE
  d           DATE;
  nb_sales    INT;
  prod        RECORD;
  pool        UUID[];
  buyer_id    UUID;
  qty         INT;
  total_amt   DECIMAL;
  pay_method  TEXT;
  r           FLOAT;
  v_bal       DECIMAL;
  v_bonus     DECIMAL;
  v_bonus_used DECIMAL;
  v_real_used  DECIMAL;
  sale_ts     TIMESTAMPTZ;
  admin_id    UUID;
  total_sales INT := 0;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;
  SELECT array_agg(id) INTO pool
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  FOR d IN SELECT generate_series('2026-04-01'::DATE, '2026-04-28'::DATE, '1 day'::INTERVAL)::DATE LOOP
    nb_sales := 2 + floor(random() * 4)::INT;
    FOR i IN 1..nb_sales LOOP
      SELECT id, name, price INTO prod
      FROM products WHERE is_active = true
      ORDER BY random() LIMIT 1;

      qty       := 1 + floor(random() * 2)::INT;
      total_amt := prod.price * qty;
      buyer_id  := pool[floor(random() * array_length(pool, 1))::INT + 1];
      sale_ts   := d::TIMESTAMPTZ + (8 + random() * 14) * INTERVAL '1 hour';

      r := random();
      IF r < 0.75 THEN pay_method := 'balance';
      ELSIF r < 0.90 THEN pay_method := 'cb';
      ELSE pay_method := 'cash';
      END IF;

      IF pay_method = 'balance' THEN
        SELECT balance, balance_bonus INTO v_bal, v_bonus
        FROM profiles WHERE id = buyer_id FOR UPDATE;
        IF (v_bal + v_bonus) < total_amt THEN
          pay_method := 'cb';
        END IF;
      END IF;

      IF pay_method = 'balance' THEN
        IF v_bonus >= total_amt THEN
          v_bonus_used := total_amt; v_real_used := 0;
        ELSE
          v_bonus_used := v_bonus; v_real_used := total_amt - v_bonus;
        END IF;
        UPDATE profiles SET
          balance       = balance       - v_real_used,
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

      total_sales := total_sales + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Étape 3 OK : % ventes POS posées sur avril', total_sales;
END $$;

-- =========================================
-- ÉTAPE 4 : recompute TVA sur toutes les ventes POS d'avril
-- =========================================
UPDATE transactions t
SET tva_rate   = effective.rate,
    amount_ht  = ROUND(t.amount / (1 + effective.rate / 100), 2),
    amount_tva = t.amount - ROUND(t.amount / (1 + effective.rate / 100), 2)
FROM (
  SELECT p.id AS product_id,
         COALESCE(p.tva_rate, c.tva_rate, 20) AS rate
  FROM products p
  LEFT JOIN product_categories c ON c.id = p.category_id
) effective
WHERE t.product_id = effective.product_id
  AND t.type IN ('debit_product', 'external_payment')
  AND t.product_id IS NOT NULL
  AND t.created_at >= '2026-04-01'::TIMESTAMPTZ
  AND t.created_at <  '2026-04-29'::TIMESTAMPTZ;
