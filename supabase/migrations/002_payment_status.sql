-- ============================================
-- MIGRATION 002 : Payment status tracking
-- ============================================

-- 1. Ajouter payment_status sur bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'partial', 'paid'));

-- 2. Ajouter payment_status sur booking_players
ALTER TABLE booking_players ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'external'));

-- 3. Trigger : auto-update bookings.payment_status quand booking_players change
CREATE OR REPLACE FUNCTION update_booking_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_booking_id UUID;
    v_total INTEGER;
    v_settled INTEGER;
BEGIN
    v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

    -- Compter le total de joueurs et ceux qui ont payé (paid ou external)
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE payment_status IN ('paid', 'external'))
    INTO v_total, v_settled
    FROM booking_players
    WHERE booking_id = v_booking_id;

    -- Mettre à jour le statut de la réservation
    IF v_total = 0 THEN
        UPDATE bookings SET payment_status = 'pending' WHERE id = v_booking_id;
    ELSIF v_settled >= v_total THEN
        UPDATE bookings SET payment_status = 'paid' WHERE id = v_booking_id;
    ELSIF v_settled > 0 THEN
        UPDATE bookings SET payment_status = 'partial' WHERE id = v_booking_id;
    ELSE
        UPDATE bookings SET payment_status = 'pending' WHERE id = v_booking_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_booking_player_payment ON booking_players;
CREATE TRIGGER tr_booking_player_payment
    AFTER INSERT OR UPDATE OR DELETE ON booking_players
    FOR EACH ROW EXECUTE FUNCTION update_booking_payment_status();

-- 4. RLS : permettre aux users auth d'insérer des booking_players
--    (pour l'invitation de joueurs par le réservant)
DROP POLICY IF EXISTS "BookingPlayers: user insère" ON booking_players;
CREATE POLICY "BookingPlayers: user insère" ON booking_players
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 5. RLS : permettre aux users de modifier les booking_players de leurs réservations
DROP POLICY IF EXISTS "BookingPlayers: user update own booking" ON booking_players;
CREATE POLICY "BookingPlayers: user update own booking" ON booking_players
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_players.booking_id AND bookings.user_id = auth.uid())
        OR auth.uid() = user_id
    );
