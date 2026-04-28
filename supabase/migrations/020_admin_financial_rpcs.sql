-- ============================================
-- 020_admin_financial_rpcs
-- ============================================
-- 2 RPCs pour nourrir la page Rapport financier :
--   1) admin_financial_summary(p_from, p_to) — 1 ligne avec tous les
--      agrégats nécessaires aux KPIs + tabs + encaissement.
--   2) admin_financial_tva(p_from, p_to) — 1 ligne par taux de TVA
--      avec base HT, TVA collectée, TTC, nb transactions.
--
-- Bucketing en Europe/Paris (cohérent avec admin_daily_revenue).
-- Sécurité : restreint aux admins via is_admin().
-- ============================================

-- =========================================
-- RPC 1 : agrégats globaux
-- =========================================
CREATE OR REPLACE FUNCTION admin_financial_summary(p_from DATE, p_to DATE)
RETURNS TABLE (
  -- Sessions (ventes terrain : debit_session + external_payment lié à booking_id)
  sessions_count   INT,
  sessions_total   NUMERIC,
  sessions_wallet  NUMERIC,
  sessions_cb      NUMERIC,
  sessions_cash    NUMERIC,
  -- Articles (ventes POS : debit_product + external_payment lié à product_id)
  articles_count   INT,
  articles_total   NUMERIC,
  articles_wallet  NUMERIC,
  articles_cb      NUMERIC,
  articles_cash    NUMERIC,
  -- Recharges wallet (type=credit)
  recharges_count  INT,
  recharges_total  NUMERIC,
  recharges_cb     NUMERIC,
  recharges_cash   NUMERIC,
  -- Encaissement caisse (vraie entrée d'argent : CB + cash sur tous types)
  encaissement_cb     NUMERIC,
  encaissement_cash   NUMERIC,
  encaissement_total  NUMERIC,
  -- Wallet débité (info — déjà encaissé via recharges antérieures)
  wallet_debited   NUMERIC,
  -- HT / TVA / TTC totaux (sessions + articles + tx avec TVA, hors crédits)
  total_ht         NUMERIC,
  total_tva        NUMERIC,
  total_ttc        NUMERIC,
  -- Nb tx par méthode (pour les tabs Wallet / CB / Espèces / Tout)
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
      -- Sessions
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
      -- Articles
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
      -- Recharges
      COUNT(*) FILTER (WHERE type = 'credit')::INT,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit' AND payment_method = 'cb'),   0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit' AND payment_method = 'cash'), 0)::NUMERIC,
      -- Encaissement caisse (CB + cash sur tous les types)
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cb'),   0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE payment_method = 'cash'), 0)::NUMERIC,
      COALESCE(SUM(amount) FILTER (WHERE payment_method IN ('cb', 'cash')), 0)::NUMERIC,
      -- Wallet débité (sessions + articles wallet)
      COALESCE(SUM(amount) FILTER (
        WHERE payment_method = 'balance'
          AND type IN ('debit_session', 'debit_product')
      ), 0)::NUMERIC,
      -- HT / TVA / TTC sur ventes taxables (hors crédits, hors tx sans TVA)
      COALESCE(SUM(amount_ht)  FILTER (WHERE type <> 'credit' AND tva_rate IS NOT NULL AND tva_rate > 0), 0)::NUMERIC,
      COALESCE(SUM(amount_tva) FILTER (WHERE type <> 'credit' AND tva_rate IS NOT NULL AND tva_rate > 0), 0)::NUMERIC,
      COALESCE(SUM(amount)     FILTER (WHERE type <> 'credit' AND tva_rate IS NOT NULL AND tva_rate > 0), 0)::NUMERIC,
      -- Compteurs par méthode
      COUNT(*) FILTER (WHERE payment_method = 'balance')::INT,
      COUNT(*) FILTER (WHERE payment_method = 'cb')::INT,
      COUNT(*) FILTER (WHERE payment_method = 'cash')::INT,
      COUNT(*)::INT
    FROM t;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_financial_summary(DATE, DATE) TO authenticated;

-- =========================================
-- RPC 2 : ventilation TVA par taux
-- =========================================
CREATE OR REPLACE FUNCTION admin_financial_tva(p_from DATE, p_to DATE)
RETURNS TABLE (
  rate  NUMERIC,
  ht    NUMERIC,
  tva   NUMERIC,
  ttc   NUMERIC,
  count INT
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
    SELECT
      t.tva_rate::NUMERIC AS rate,
      COALESCE(SUM(t.amount_ht),  0)::NUMERIC AS ht,
      COALESCE(SUM(t.amount_tva), 0)::NUMERIC AS tva,
      COALESCE(SUM(t.amount),     0)::NUMERIC AS ttc,
      COUNT(*)::INT AS count
    FROM transactions t
    WHERE ((t.created_at AT TIME ZONE 'Europe/Paris')::date) BETWEEN p_from AND p_to
      AND t.type <> 'credit'
      AND t.tva_rate IS NOT NULL
      AND t.tva_rate > 0
    GROUP BY t.tva_rate
    ORDER BY t.tva_rate;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_financial_tva(DATE, DATE) TO authenticated;
