-- ============================================
-- 018_admin_daily_revenue_rpc
-- ============================================
-- RPC qui agrège côté Postgres le CA Sessions + Articles par jour
-- pour la période [p_from, p_to]. Retourne ≤ 31 lignes — élimine le
-- risque de cap de lignes PostgREST côté front et accélère le dashboard
-- (un seul aller-retour, pas de calcul client sur des milliers de tx).
--
-- Règles de classification (alignées sur AdminDash) :
--   sessions = debit_session
--            + external_payment lié à un booking_id
--   articles = debit_product
--            + external_payment lié à un product_id
--
-- Le bucket par jour utilise le fuseau Europe/Paris pour que les
-- transactions tardives (22h-minuit) ne soient pas reclassées au
-- lendemain UTC.
-- ============================================

CREATE OR REPLACE FUNCTION admin_daily_revenue(p_from DATE, p_to DATE)
RETURNS TABLE (
  day      DATE,
  sessions NUMERIC,
  articles NUMERIC
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
      ((t.created_at AT TIME ZONE 'Europe/Paris')::date) AS day,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.type = 'debit_session'
           OR (t.type = 'external_payment' AND t.booking_id IS NOT NULL)
      ), 0)::numeric AS sessions,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.type = 'debit_product'
           OR (t.type = 'external_payment' AND t.product_id IS NOT NULL)
      ), 0)::numeric AS articles
    FROM transactions t
    WHERE ((t.created_at AT TIME ZONE 'Europe/Paris')::date) BETWEEN p_from AND p_to
    GROUP BY ((t.created_at AT TIME ZONE 'Europe/Paris')::date)
    ORDER BY 1;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_daily_revenue(DATE, DATE) TO authenticated;
