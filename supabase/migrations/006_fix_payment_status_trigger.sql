-- ============================================
-- MIGRATION 006 : Fix payment status trigger
-- Basé sur les MONTANTS payés vs prix total, pas sur le comptage de joueurs
-- ============================================

CREATE OR REPLACE FUNCTION update_booking_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id UUID;
    v_total_price DECIMAL;
    v_total_paid DECIMAL;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    -- Récupérer le prix total de la session
    SELECT price INTO v_total_price
    FROM bookings
    WHERE id = v_booking_id;

    -- Calculer le total payé (somme des montants des joueurs avec statut paid ou external)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM booking_players
    WHERE booking_id = v_booking_id
      AND payment_status IN ('paid', 'external');

    -- Mettre à jour le statut basé sur les montants
    IF v_total_paid >= v_total_price THEN
        UPDATE bookings SET payment_status = 'paid' WHERE id = v_booking_id;
    ELSIF v_total_paid > 0 THEN
        UPDATE bookings SET payment_status = 'partial' WHERE id = v_booking_id;
    ELSE
        UPDATE bookings SET payment_status = 'pending' WHERE id = v_booking_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
