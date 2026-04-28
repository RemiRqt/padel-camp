-- ============================================
-- 026_public_today_availability
-- ============================================
-- Expose une vue minimale (court_id + start_time) des réservations
-- confirmées du jour aux visiteurs anon de la landing.
--
-- Pourquoi : la policy RLS de bookings bloque anon (auth.uid() IS NOT NULL),
-- donc un visiteur non connecté ne voyait aucune résa et tous les créneaux
-- s'affichaient comme libres. On contourne via une RPC SECURITY DEFINER
-- qui ne renvoie QUE les colonnes non-PII (pas user_id, pas price, pas
-- payment_status).
-- ============================================

CREATE OR REPLACE FUNCTION public_today_availability()
RETURNS TABLE(court_id TEXT, start_time TIME)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT court_id, start_time
    FROM bookings
   WHERE date = CURRENT_DATE
     AND status = 'confirmed';
$$;

REVOKE EXECUTE ON FUNCTION public_today_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_today_availability() TO anon, authenticated;
