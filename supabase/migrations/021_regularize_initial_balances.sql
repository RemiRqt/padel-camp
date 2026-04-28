-- ============================================
-- 021_regularize_initial_balances
-- ============================================
-- Cohérence wallet : pour chaque membre, on calcule la balance théorique
-- depuis l'historique des transactions et on insère une transaction
-- `credit` (CB ou espèces) datée 1er mars qui rattrape l'éventuel "ghost
-- balance" — typiquement les soldes initiaux fixés en dur dans
-- 004_seed_data.sql et 012_demo_polish.sql sans transaction associée.
--
-- Après cette migration :
--   wallet_actuel = sommes des credits + credit_bonus + bonus_amount
--                 - somme des débits wallet
-- → l'écart "wallet débité vs recharges encaissées" devient cohérent
--   (il ne restera que le bonus consommé, qui est une grandeur légitime).
-- ============================================

DO $$
DECLARE
  m            RECORD;
  admin_id     UUID;
  expected_total NUMERIC;
  current_total  NUMERIC;
  gap          NUMERIC;
  pay_method   TEXT;
  ts           TIMESTAMPTZ;
  fixed_count  INT := 0;
  total_gap    NUMERIC := 0;
BEGIN
  SELECT id INTO admin_id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

  FOR m IN
    SELECT id, balance, balance_bonus
    FROM profiles
    WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com')
  LOOP
    current_total := COALESCE(m.balance, 0) + COALESCE(m.balance_bonus, 0);

    -- Mouvement net wallet calculé depuis les transactions
    SELECT COALESCE(SUM(
      CASE
        WHEN type = 'credit'       THEN amount + COALESCE(bonus_amount, 0)
        WHEN type = 'credit_bonus' THEN amount
        WHEN type IN ('debit_session', 'debit_product')
          AND payment_method = 'balance' THEN -amount
        ELSE 0
      END
    ), 0)
    INTO expected_total
    FROM transactions
    WHERE user_id = m.id;

    gap := ROUND(current_total - expected_total, 2);

    -- Tolérance 1 cent pour erreurs d'arrondi
    IF gap > 0.01 THEN
      pay_method := CASE WHEN random() < 0.6 THEN 'cb' ELSE 'cash' END;
      ts := '2026-03-01'::TIMESTAMPTZ + (random() * 10)::INT * INTERVAL '1 hour';

      INSERT INTO transactions (
        user_id, type, amount, description, performed_by,
        payment_method, created_at,
        formula_amount_paid, formula_amount_credited
      ) VALUES (
        m.id, 'credit', gap,
        'Solde initial (régularisation comptable)',
        admin_id, pay_method::payment_method, ts,
        gap, gap
      );

      fixed_count := fixed_count + 1;
      total_gap   := total_gap + gap;
    END IF;
  END LOOP;

  RAISE NOTICE 'Régularisation OK : % membres, % € de soldes initiaux backfillés',
    fixed_count, ROUND(total_gap, 2);
END $$;
