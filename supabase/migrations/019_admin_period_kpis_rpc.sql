-- ============================================
-- 019_admin_period_kpis_rpc
-- ============================================
-- RPC qui calcule côté Postgres les 4 KPIs financiers du dashboard
-- pour la période [p_from, p_to]. Retourne 1 ligne — élimine le cap
-- PostgREST sur les transactions brutes.
--
-- KPIs :
--   ca_sessions        = debit_session + external_payment lié à booking_id
--   ca_articles        = debit_product + external_payment lié à product_id
--   recharges          = type='credit'
--   encaissement_caisse = somme des montants payés en CB ou espèces (tous types)
-- ============================================

CREATE OR REPLACE FUNCTION admin_period_kpis(p_from DATE, p_to DATE)
RETURNS TABLE (
  ca_sessions         NUMERIC,
  ca_articles         NUMERIC,
  recharges           NUMERIC,
  encaissement_caisse NUMERIC
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
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.type = 'debit_session'
           OR (t.type = 'external_payment' AND t.booking_id IS NOT NULL)
      ), 0)::numeric AS ca_sessions,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.type = 'debit_product'
           OR (t.type = 'external_payment' AND t.product_id IS NOT NULL)
      ), 0)::numeric AS ca_articles,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'credit'), 0)::numeric AS recharges,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.payment_method IN ('cb', 'cash')
      ), 0)::numeric AS encaissement_caisse
    FROM transactions t
    WHERE ((t.created_at AT TIME ZONE 'Europe/Paris')::date) BETWEEN p_from AND p_to;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_period_kpis(DATE, DATE) TO authenticated;
