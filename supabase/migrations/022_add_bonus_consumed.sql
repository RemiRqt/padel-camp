-- ============================================
-- 022_add_bonus_consumed
-- ============================================
-- Étend admin_financial_summary avec :
--   - bonus_consumed : somme des bonus_used sur les débits wallet
--                      (= cadeau du club consommé pendant la période)
-- ============================================

DROP FUNCTION IF EXISTS admin_financial_summary(DATE, DATE);

CREATE OR REPLACE FUNCTION admin_financial_summary(p_from DATE, p_to DATE)
RETURNS TABLE (
  sessions_count   INT,
  sessions_total   NUMERIC,
  sessions_wallet  NUMERIC,
  sessions_cb      NUMERIC,
  sessions_cash    NUMERIC,
  articles_count   INT,
  articles_total   NUMERIC,
  articles_wallet  NUMERIC,
  articles_cb      NUMERIC,
  articles_cash    NUMERIC,
  recharges_count  INT,
  recharges_total  NUMERIC,
  recharges_cb     NUMERIC,
  recharges_cash   NUMERIC,
  encaissement_cb     NUMERIC,
  encaissement_cash   NUMERIC,
  encaissement_total  NUMERIC,
  wallet_debited   NUMERIC,
  bonus_consumed   NUMERIC,
  total_ht         NUMERIC,
  total_tva        NUMERIC,
  total_ttc        NUMERIC,
  count_balance    INT,
  count_cb         INT,
  count_cash       INT,
  count_total      INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  RETURN QUERY
    WITH t AS (
      SELECT * FROM transactions
      WHERE ((created_at AT TIME ZONE 'Europe/Paris')::date) BETWEEN p_from AND p_to
    )
    SELECT
      COUNT(*) FILTER (
        WHERE type = 'debit_session'
           OR (type = 'external_payment' AND booking_id IS NOT NULL)
      )::INT,
      COALESCE(SUM(amount) FILTER (
        WHERE type = 'debit_session'
           OR (type = 'external_payment' AND booking_id IS NOT NULL)
      ), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE (type = 'debit_session' OR (type = 'external_payment' AND booking_id IS NOT NULL))
          AND payment_method = 'balance'
      ), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE (type = 'debit_session' OR (type = 'external_payment' AND booking_id IS NOT NULL))
          AND payment_method = 'cb'
      ), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE (type = 'debit_session' OR (type = 'external_payment' AND booking_id IS NOT NULL))
          AND payment_method = 'cash'
      ), 0)::NUMERIC,
      COUNT(*) FILTER (
        WHERE type = 'debit_product'
           OR (type = 'external_payment' AND product_id IS NOT NULL)
      )::INT,
      COALESCE(SUM(amount) FILTER (
        WHERE type = 'debit_product'
           OR (type = 'external_payment' AND product_id IS NOT NULL)
      ), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE (type = 'debit_product' OR (type = 'external_payment' AND product_id IS NOT NULL))
          AND payment_method = 'balance'
      ), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE (type = 'debit_product' OR (type = 'external_payment' AND product_id IS NOT NULL))
          AND payment_method = 'cb'
      ), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE (type = 'debit_product' OR (type = 'external_payment' AND product_id IS NOT NULL))
          AND payment_method = 'cash'
      ), 0)::NUMERIC,
      COUNT(*) FILTER (WHERE type = 'credit')::INT,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit' AND payment_method = 'cb'),   0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit' AND payment_method = 'cash'), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cb'),   0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE payment_method IN ('cb', 'cash')), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (
        WHERE payment_method = 'balance'
          AND type IN ('debit_session', 'debit_product')
      ), 0)::NUMERIC,
      -- Bonus consommé = cadeau du club brûlé sur les débits wallet
      COALESCE(SUM(bonus_used) FILTER (
        WHERE type IN ('debit_session', 'debit_product')
      ), 0)::NUMERIC,
      COALESCE(SUM(amount_ht)  FILTER (WHERE type <> 'credit' AND tva_rate IS NOT NULL AND tva_rate > 0), 0)::NUMERIC,
      COALESCE(SUM(amount_tva) FILTER (WHERE type <> 'credit' AND tva_rate IS NOT NULL AND tva_rate > 0), 0)::NUMERIC,
      COALESCE(SUM(amount)     FILTER (WHERE type <> 'credit' AND tva_rate IS NOT NULL AND tva_rate > 0), 0)::NUMERIC,
      COUNT(*) FILTER (WHERE payment_method = 'balance')::INT,
      COUNT(*) FILTER (WHERE payment_method = 'cb')::INT,
      COUNT(*) FILTER (WHERE payment_method = 'cash')::INT,
      COUNT(*)::INT
    FROM t;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_financial_summary(DATE, DATE) TO authenticated;
