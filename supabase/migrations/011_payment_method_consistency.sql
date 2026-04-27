-- =====================================================================
-- Migration 011 — Cohérence payment_method sur transactions
-- =====================================================================
-- Avant : debit_user() et credit_user() n'insèrent pas payment_method.
-- → 90% des lignes transactions.payment_method = NULL → rapport
--   financier inutilisable (impossible de séparer wallet / CB / espèces).
--
-- Après :
--   - debit_user()  insère payment_method = 'balance'
--   - credit_user() accepte un paramètre p_payment_method ('cb' | 'cash')
--   - Backfill : tous les debits historiques → 'balance'
--                les credits historiques → 'mixed' (origine non
--                récupérable, mais on évite les NULL silencieux)
-- =====================================================================

-- 1) debit_user : ajouter payment_method = 'balance' à l'INSERT
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
SET search_path = public
AS $$
DECLARE
    v_balance DECIMAL;
    v_balance_bonus DECIMAL;
    v_bonus_used DECIMAL := 0;
    v_real_used DECIMAL := 0;
    v_result JSON;
BEGIN
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

-- 2) credit_user : accepter p_payment_method ('cb' | 'cash')
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
SET search_path = public
AS $$
DECLARE
    v_bonus DECIMAL := 0;
    v_credited DECIMAL;
BEGIN
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

    -- Bonus n'est pas un encaissement (offert), payment_method = 'balance'
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

-- 3) Backfill : tous les debits historiques → 'balance'
UPDATE transactions
   SET payment_method = 'balance'
 WHERE payment_method IS NULL
   AND type IN ('debit_session', 'debit_product');

-- 4) Backfill : credits sans méthode → 'mixed' (origine indéterminée)
UPDATE transactions
   SET payment_method = 'mixed'
 WHERE payment_method IS NULL
   AND type IN ('credit', 'credit_bonus');

-- 5) Vérification post-migration (à lancer manuellement) :
--    SELECT type, payment_method, COUNT(*) FROM transactions
--     GROUP BY type, payment_method ORDER BY type, payment_method;
--    -> doit montrer 0 NULL.
