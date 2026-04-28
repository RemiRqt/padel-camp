-- ============================================
-- 025_revoke_public_execute
-- ============================================
-- Le linter Supabase signale toujours toutes les fonctions SECURITY DEFINER
-- comme exécutables par anon/authenticated même après la migration 024.
--
-- Cause : en Postgres, les fonctions sont créées avec un GRANT EXECUTE
-- implicite à PUBLIC (qui contient anon ET authenticated). REVOKE FROM anon
-- ne supprime pas l'héritage via PUBLIC.
--
-- Solution :
--   1) REVOKE EXECUTE ... FROM PUBLIC pour couper l'héritage
--   2) GRANT EXECUTE ... TO authenticated pour les RPC nécessaires
--      (le check is_admin() interne filtre déjà les non-admins)
--   3) Trigger functions : pas de GRANT (Postgres ne vérifie pas EXECUTE
--      lors du déclenchement d'un trigger)
--   4) is_admin / is_user_admin : passées en SECURITY INVOKER. profiles a
--      déjà une policy "lecture publique limitée FOR SELECT USING (true)"
--      donc l'invoker peut lire sa propre ligne.
-- ============================================

-- 1) is_admin / is_user_admin : SECURITY INVOKER
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION is_user_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = uid AND role = 'admin');
$$;

-- 2) REVOKE de PUBLIC sur les RPC sensibles
REVOKE EXECUTE ON FUNCTION debit_user(UUID, DECIMAL, TEXT, UUID, transaction_type, UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION credit_user(UUID, UUID, DECIMAL, DECIMAL, TEXT, TEXT) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION admin_period_kpis(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_daily_revenue(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_financial_summary(DATE, DATE) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_financial_tva(DATE, DATE) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION record_external_transaction(
    NUMERIC, transaction_type, TEXT, UUID, TEXT, UUID, UUID, UUID
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION search_members_unaccented(TEXT, INTEGER, UUID) FROM PUBLIC;

-- 3) Trigger functions : REVOKE de PUBLIC (Postgres n'exige pas EXECUTE pour
--    qu'un trigger se déclenche)
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_booking_payment_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_confirmation_deadline() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION compute_transaction_tva() FROM PUBLIC;

-- 4) GRANT explicite à authenticated pour les RPC appelées par l'app
--    (l'auth check interne filtre admin vs membre selon les besoins)
GRANT EXECUTE ON FUNCTION debit_user(UUID, DECIMAL, TEXT, UUID, transaction_type, UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION credit_user(UUID, UUID, DECIMAL, DECIMAL, TEXT, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION admin_period_kpis(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_daily_revenue(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_financial_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_financial_tva(DATE, DATE) TO authenticated;

GRANT EXECUTE ON FUNCTION record_external_transaction(
    NUMERIC, transaction_type, TEXT, UUID, TEXT, UUID, UUID, UUID
) TO authenticated;

GRANT EXECUTE ON FUNCTION search_members_unaccented(TEXT, INTEGER, UUID) TO authenticated;

-- is_admin / is_user_admin : SECURITY INVOKER → pas besoin de GRANT explicite,
-- les policies RLS qui les appellent fonctionnent dans le contexte du caller.
-- Mais on les garde explicitement disponibles pour éviter tout effet de bord
-- sur le PUBLIC implicite.
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_user_admin(UUID) TO authenticated, anon;
