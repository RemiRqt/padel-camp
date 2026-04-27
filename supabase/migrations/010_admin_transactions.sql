-- =====================================================================
-- Migration 010 — RPC pour transactions externes (CB / Espèces)
-- =====================================================================
-- Avant : markPlayerExternal et adminSellProduct (paiement non-balance)
-- faisaient un INSERT direct sur public.transactions depuis le client.
-- La policy INSERT exige is_admin(), ce qui peut casser selon le contexte
-- d'auth (JWT, session). Surtout, c'est mauvais design : aucune écriture
-- financière ne devrait partir du client.
--
-- Après : une seule RPC SECURITY DEFINER vérifie is_admin() côté serveur
-- puis insère. Les policies peuvent rester strictes (is_admin() WITH CHECK).
-- =====================================================================

CREATE OR REPLACE FUNCTION record_external_transaction(
    p_amount         DECIMAL,
    p_type           transaction_type,
    p_description    TEXT,
    p_performed_by   UUID,
    p_payment_method TEXT,                -- 'cb' | 'cash'
    p_user_id        UUID DEFAULT NULL,
    p_booking_id     UUID DEFAULT NULL,
    p_product_id     UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Forbidden: admin only';
    END IF;
    IF p_payment_method NOT IN ('cb', 'cash') THEN
        RAISE EXCEPTION 'payment_method must be cb or cash (got %)', p_payment_method;
    END IF;

    INSERT INTO transactions (
        user_id, type, amount, description, performed_by,
        booking_id, product_id, payment_method
    )
    VALUES (
        p_user_id, p_type, p_amount, p_description, p_performed_by,
        p_booking_id, p_product_id, p_payment_method
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Permettre l'appel via PostgREST (rôles authenticated + service_role)
GRANT EXECUTE ON FUNCTION record_external_transaction(
    DECIMAL, transaction_type, TEXT, UUID, TEXT, UUID, UUID, UUID
) TO authenticated, service_role;
