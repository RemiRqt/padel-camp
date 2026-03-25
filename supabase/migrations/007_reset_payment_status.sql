-- ============================================
-- MIGRATION 007 : Reset all payment statuses
-- Remet tous les paiements sessions à zéro
-- ============================================

-- Reset booking_players payment status
UPDATE booking_players SET payment_status = 'pending';

-- Reset bookings payment status
UPDATE bookings SET payment_status = 'pending';

-- Supprimer les transactions de type session/external pour repartir propre
DELETE FROM transactions WHERE type IN ('debit_session', 'external_payment');
