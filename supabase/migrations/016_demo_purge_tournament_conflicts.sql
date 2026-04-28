-- ============================================
-- 016_demo_purge_tournament_conflicts
-- ============================================
-- Cohérence du seed démo : un tournoi (ou événement) bloque tous les
-- terrains pendant son créneau. La règle de chevauchement appliquée
-- côté UI est :
--   booking.start_time < event.end_time AND booking.end_time > event.start_time
-- avec le statut tournoi non 'cancelled'.
--
-- Cette migration :
--   1) Identifie toutes les résas en conflit avec un tournoi ou
--      un événement (même date + chevauchement horaire).
--   2) Rembourse les wallets pour les debit_session correspondants
--      (real_used → balance, bonus_used → balance_bonus).
--   3) Supprime les transactions liées (debit_session + external_payment
--      avec booking_id pointant vers ces résas).
--   4) Supprime les booking_players de ces résas.
--   5) Supprime les bookings eux-mêmes.
--
-- Idempotent : si rien à purger, ne fait rien.
-- ============================================

DO $$
DECLARE
  conflicting_booking_ids UUID[];
  refunded_users INT := 0;
  deleted_tx INT := 0;
  deleted_bp INT := 0;
  deleted_bk INT := 0;
BEGIN
  -- 1) Collecte des bookings en conflit
  WITH blocking AS (
    SELECT date, start_time, end_time FROM tournaments WHERE status <> 'cancelled'
    UNION ALL
    SELECT date, start_time, end_time FROM events
  )
  SELECT array_agg(DISTINCT b.id)
  INTO conflicting_booking_ids
  FROM bookings b
  JOIN blocking bl
    ON bl.date = b.date
   AND b.start_time < bl.end_time
   AND b.end_time   > bl.start_time;

  IF conflicting_booking_ids IS NULL OR array_length(conflicting_booking_ids, 1) = 0 THEN
    RAISE NOTICE 'Migration 016 : aucune résa en conflit, rien à purger';
    RETURN;
  END IF;

  RAISE NOTICE 'Migration 016 : % résa(s) en conflit détectée(s)', array_length(conflicting_booking_ids, 1);

  -- 2) Rembourser les wallets pour les debit_session
  WITH refund AS (
    SELECT user_id,
           COALESCE(SUM(real_used), 0)  AS r_used,
           COALESCE(SUM(bonus_used), 0) AS b_used
    FROM transactions
    WHERE type = 'debit_session'
      AND booking_id = ANY(conflicting_booking_ids)
      AND user_id IS NOT NULL
    GROUP BY user_id
  )
  UPDATE profiles p
  SET balance       = p.balance       + r.r_used,
      balance_bonus = p.balance_bonus + r.b_used
  FROM refund r
  WHERE p.id = r.user_id;
  GET DIAGNOSTICS refunded_users = ROW_COUNT;

  -- 3) Supprimer toutes les transactions liées à ces bookings
  DELETE FROM transactions
  WHERE booking_id = ANY(conflicting_booking_ids);
  GET DIAGNOSTICS deleted_tx = ROW_COUNT;

  -- 4) Supprimer les booking_players
  DELETE FROM booking_players
  WHERE booking_id = ANY(conflicting_booking_ids);
  GET DIAGNOSTICS deleted_bp = ROW_COUNT;

  -- 5) Supprimer les bookings
  DELETE FROM bookings
  WHERE id = ANY(conflicting_booking_ids);
  GET DIAGNOSTICS deleted_bk = ROW_COUNT;

  RAISE NOTICE 'Migration 016 OK : % wallets recrédités, % transactions supprimées, % booking_players supprimés, % bookings supprimés',
    refunded_users, deleted_tx, deleted_bp, deleted_bk;
END $$;
