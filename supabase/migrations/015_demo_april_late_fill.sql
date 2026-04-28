-- ============================================
-- 015_demo_april_late_fill
-- ============================================
-- La migration 012 a été exécutée mi-avril, donc les règlements de
-- sessions et ventes POS s'arrêtent à cette date. On comble le trou
-- pour toutes les journées passées d'avril qui n'ont pas encore été
-- traitées (idempotent : on saute les bookings/jours déjà règlementés).
-- ============================================

-- =========================================
-- Sessions passées non encore réglées (4 joueurs/résa, mix wallet/CB/cash)
-- =========================================
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
          pay_method := 'cb';
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

  RAISE NOTICE 'Task 015a OK : % règlements de sessions ajoutés', total_bp;
END $$;

-- =========================================
-- Ventes POS sur les jours sans ou peu d'activité
-- (cible 2-5 ventes/jour)
-- =========================================
DO $$
DECLARE
  d DATE;
  existing INT;
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
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  SELECT array_agg(id) INTO pool
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  FOR d IN SELECT generate_series('2026-04-01'::DATE, (CURRENT_DATE - 1)::DATE, '1 day'::INTERVAL)::DATE LOOP
    SELECT count(*) INTO existing
    FROM transactions
    WHERE type IN ('debit_product', 'external_payment')
      AND product_id IS NOT NULL
      AND created_at::DATE = d;

    IF existing >= 2 THEN
      CONTINUE;  -- jour déjà bien rempli
    END IF;

    nb_sales := 2 + floor(random() * 4)::INT;  -- 2 à 5

    FOR i IN 1..nb_sales LOOP
      SELECT id, name, price INTO prod
      FROM products
      WHERE is_active = true
      ORDER BY random()
      LIMIT 1;

      qty := 1 + floor(random() * 2)::INT;
      total_amt := prod.price * qty;
      buyer_id := pool[floor(random() * array_length(pool, 1))::INT + 1];
      sale_ts := d::TIMESTAMPTZ + (8 + random() * 14) * INTERVAL '1 hour';

      r := random();
      IF r < 0.60 THEN pay_method := 'balance';
      ELSIF r < 0.85 THEN pay_method := 'cb';
      ELSE pay_method := 'cash';
      END IF;

      IF pay_method = 'balance' THEN
        SELECT balance, balance_bonus INTO v_balance, v_balance_bonus
        FROM profiles WHERE id = buyer_id FOR UPDATE;
        IF (v_balance + v_balance_bonus) < total_amt THEN
          pay_method := 'cb';
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

  RAISE NOTICE 'Task 015b OK : % ventes POS ajoutées sur les jours creux', total;
END $$;

-- =========================================
-- Recompute TVA sur les nouvelles transactions POS
-- (les anciennes ont déjà été traitées en migration 012)
-- =========================================
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
  AND t.product_id IS NOT NULL
  AND t.tva_rate IS NULL;
