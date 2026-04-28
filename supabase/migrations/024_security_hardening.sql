-- ============================================
-- 024_security_hardening
-- ============================================
-- Corrige les warnings du linter Supabase :
--   1) Fonctions SECURITY DEFINER sans search_path immuable
--   2) RPC sensibles exécutables par anon (anon_security_definer_function_executable)
--   3) debit_user / credit_user n'avaient AUCUN check d'autorisation interne
--      → un anon pouvait potentiellement débiter / créditer n'importe quel wallet.
--
-- Modèle d'autorisation :
--   - debit_user  : admin OU propriétaire du compte (auth.uid() = p_user_id)
--   - credit_user : admin uniquement
--   - admin_*     : admin uniquement (déjà en place côté code, durci côté permissions)
--
-- Bonus sécurité :
--   - REVOKE EXECUTE depuis anon sur toutes les RPC sensibles
--   - REVOKE EXECUTE depuis anon ET authenticated sur les fonctions trigger pures
--     (handle_new_user, update_booking_payment_status, set_confirmation_deadline,
--      update_updated_at, compute_transaction_tva) → seul le moteur de triggers les
--     appelle.
-- ============================================

-- 1) Trigger functions : search_path immuable + REVOKE EXECUTE de PUBLIC

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_confirmation_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.confirmation_deadline = (NEW.date + NEW.start_time) - INTERVAL '48 hours';
    RETURN NEW;
END;
$$;

-- handle_new_user reste SECURITY DEFINER (insère un profil pour le NEW user)
-- mais ne doit pas être appelable hors du trigger.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$;

-- compute_transaction_tva (trigger BEFORE INSERT sur transactions, défini en migration 008)
-- On le récupère et on le redéfinit avec SET search_path.
-- Note : on garde la même logique. Si la version 008 a évolué entre temps,
-- il faudra ajuster.
CREATE OR REPLACE FUNCTION compute_transaction_tva()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rate numeric;
BEGIN
  IF NEW.tva_rate IS NOT NULL
     AND NEW.amount_ht IS NOT NULL
     AND NEW.amount_tva IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.tva_rate IS NULL THEN
    IF NEW.type = 'credit' THEN
      v_rate := 0;
    ELSIF NEW.type = 'debit_session' THEN
      SELECT tva_rate_session INTO v_rate FROM club_config LIMIT 1;
      v_rate := COALESCE(v_rate, 20);
    ELSIF NEW.type IN ('debit_product', 'external_payment') AND NEW.product_id IS NOT NULL THEN
      SELECT COALESCE(p.tva_rate, c.tva_rate, 20)
        INTO v_rate
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = NEW.product_id;
      v_rate := COALESCE(v_rate, 20);
    ELSE
      v_rate := 20;
    END IF;
    NEW.tva_rate := v_rate;
  ELSE
    v_rate := NEW.tva_rate;
  END IF;

  IF NEW.amount IS NOT NULL THEN
    IF v_rate = 0 THEN
      NEW.amount_ht  := NEW.amount;
      NEW.amount_tva := 0;
    ELSE
      NEW.amount_ht  := ROUND(NEW.amount / (1 + v_rate / 100), 2);
      NEW.amount_tva := ROUND(NEW.amount - NEW.amount_ht, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- update_booking_payment_status (trigger AFTER UPDATE sur booking_players, migration 006)
-- Refait avec SET search_path tout en gardant la logique métier.
-- (Repris à l'identique de 006_fix_payment_status_trigger.sql.)
CREATE OR REPLACE FUNCTION update_booking_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_booking_id UUID;
    v_total_price DECIMAL;
    v_total_paid DECIMAL;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    SELECT price INTO v_total_price
      FROM bookings
     WHERE id = v_booking_id;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
      FROM booking_players
     WHERE booking_id = v_booking_id
       AND payment_status IN ('paid', 'external');

    IF v_total_paid >= v_total_price THEN
        UPDATE bookings SET payment_status = 'paid'    WHERE id = v_booking_id;
    ELSIF v_total_paid > 0 THEN
        UPDATE bookings SET payment_status = 'partial' WHERE id = v_booking_id;
    ELSE
        UPDATE bookings SET payment_status = 'pending' WHERE id = v_booking_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) is_admin / is_user_admin : search_path immuable
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION is_user_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = uid AND role = 'admin');
$$;

-- 3) debit_user : ajoute le check d'auth (admin OU propriétaire)
CREATE OR REPLACE FUNCTION debit_user(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_performed_by UUID,
    p_type transaction_type,
    p_booking_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_parts_count INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_balance DECIMAL;
    v_balance_bonus DECIMAL;
    v_bonus_used DECIMAL := 0;
    v_real_used DECIMAL := 0;
    v_result JSON;
BEGIN
    -- Authz : admin OU propriétaire du compte
    IF auth.uid() IS NULL OR (NOT is_admin() AND auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'Forbidden: admin or owner only';
    END IF;

    SELECT balance, balance_bonus INTO v_balance, v_balance_bonus
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF (v_balance + v_balance_bonus) < p_amount THEN
        RAISE EXCEPTION 'Solde insuffisant: %.2f disponible, %.2f demandé',
            (v_balance + v_balance_bonus), p_amount;
    END IF;

    IF v_balance_bonus >= p_amount THEN
        v_bonus_used := p_amount;
        v_real_used := 0;
    ELSE
        v_bonus_used := v_balance_bonus;
        v_real_used := p_amount - v_balance_bonus;
    END IF;

    UPDATE profiles SET
        balance = balance - v_real_used,
        balance_bonus = balance_bonus - v_bonus_used
    WHERE id = p_user_id;

    INSERT INTO transactions (
        user_id, type, amount, bonus_used, real_used,
        description, performed_by, booking_id, product_id, parts_count,
        payment_method
    ) VALUES (
        p_user_id, p_type, p_amount, v_bonus_used, v_real_used,
        p_description, p_performed_by, p_booking_id, p_product_id, p_parts_count,
        'balance'
    );

    v_result := json_build_object(
        'bonus_used', v_bonus_used,
        'real_used', v_real_used,
        'new_balance', v_balance - v_real_used,
        'new_balance_bonus', v_balance_bonus - v_bonus_used
    );
    RETURN v_result;
END;
$$;

-- 4) credit_user : drop l'ancienne signature (5 args, pas de payment_method)
--    et ajoute le check d'auth admin sur la nouvelle (6 args).
DROP FUNCTION IF EXISTS credit_user(UUID, UUID, DECIMAL, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION credit_user(
    p_user_id UUID,
    p_performed_by UUID,
    p_amount_paid DECIMAL,
    p_amount_credited DECIMAL DEFAULT NULL,
    p_description TEXT DEFAULT 'Crédit compte',
    p_payment_method TEXT DEFAULT 'cb'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bonus DECIMAL := 0;
    v_credited DECIMAL;
BEGIN
    -- Authz : admin uniquement
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Forbidden: admin only';
    END IF;

    IF p_payment_method NOT IN ('cb', 'cash') THEN
        RAISE EXCEPTION 'payment_method must be cb or cash (got %)', p_payment_method;
    END IF;

    v_credited := COALESCE(p_amount_credited, p_amount_paid);
    v_bonus := v_credited - p_amount_paid;

    UPDATE profiles SET balance = balance + p_amount_paid WHERE id = p_user_id;

    INSERT INTO transactions (
        user_id, type, amount, description, performed_by,
        formula_amount_paid, formula_amount_credited, formula_bonus,
        payment_method
    ) VALUES (
        p_user_id, 'credit', p_amount_paid, p_description, p_performed_by,
        CASE WHEN v_bonus > 0 THEN p_amount_paid END,
        CASE WHEN v_bonus > 0 THEN v_credited END,
        CASE WHEN v_bonus > 0 THEN v_bonus END,
        p_payment_method::payment_method
    );

    IF v_bonus > 0 THEN
        UPDATE profiles SET balance_bonus = balance_bonus + v_bonus WHERE id = p_user_id;
        INSERT INTO transactions (
            user_id, type, amount, bonus_amount, description, performed_by,
            payment_method
        ) VALUES (
            p_user_id, 'credit_bonus', v_bonus, v_bonus,
            'Bonus formule (' || p_amount_paid || '€ → ' || v_credited || '€)',
            p_performed_by,
            'balance'
        );
    END IF;
END;
$$;

-- 5) REVOKE EXECUTE de anon sur les RPC sensibles.
--    is_admin() / is_user_admin() restent accessibles à tous (utilisés
--    dans les policies RLS qui sont évaluées côté DB pour chaque rôle).

REVOKE EXECUTE ON FUNCTION debit_user(UUID, DECIMAL, TEXT, UUID, transaction_type, UUID, UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION credit_user(UUID, UUID, DECIMAL, DECIMAL, TEXT, TEXT) FROM anon;

REVOKE EXECUTE ON FUNCTION admin_period_kpis(DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION admin_daily_revenue(DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION admin_financial_summary(DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION admin_financial_tva(DATE, DATE) FROM anon;

REVOKE EXECUTE ON FUNCTION record_external_transaction(
    NUMERIC, transaction_type, TEXT, UUID, TEXT, UUID, UUID, UUID
) FROM anon;

REVOKE EXECUTE ON FUNCTION search_members_unaccented(TEXT, INTEGER, UUID) FROM anon;

-- 6) Trigger functions : pas appelables comme RPC.
--    handle_new_user : utilisée par le trigger sur auth.users → ok à révoquer.
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_booking_payment_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_confirmation_deadline() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION compute_transaction_tva() FROM anon, authenticated;
