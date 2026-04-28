-- ============================================
-- 028_notifications
-- ============================================
-- Système de notifications In-App :
--   - Invitation à une réservation (booking_players invitation_status='pending')
--   - Réponse partenaire tournoi (pending_partner → pending_admin / cancelled)
--   - Décision admin tournoi (pending_admin → approved / waitlist / cancelled)
--   - Confirmation 48h tournoi (pg_cron horaire)
--   - Admin: nouvelle inscription tournoi à valider (status devient pending_admin)
--
-- Insertions exclusivement via triggers SECURITY DEFINER (pas d'INSERT côté client).
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 1) Type + table
CREATE TYPE notification_type AS ENUM (
  'booking_invitation',
  'tournament_partner_response',
  'tournament_admin_decision',
  'tournament_confirmation_required',
  'tournament_admin_review_required'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX idx_notif_user_recent ON notifications(user_id, created_at DESC);

-- 2) RLS : user lit/maj ses propres notifs ; pas d'INSERT possible côté client
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notif: user reads own"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Notif: user updates own"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Realtime : pousser les INSERT vers les clients abonnés
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 4) Trigger : invitation à une réservation
CREATE OR REPLACE FUNCTION notify_booking_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_host_uid UUID;
  v_host_name TEXT;
  v_date DATE;
  v_start TIME;
BEGIN
  IF NEW.user_id IS NULL OR NEW.invitation_status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT b.user_id, p.display_name, b.date, b.start_time
    INTO v_host_uid, v_host_name, v_date, v_start
  FROM bookings b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.id = NEW.booking_id;

  -- Pas de notif si l'host s'auto-ajoute
  IF v_host_uid IS NULL OR v_host_uid = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.user_id,
    'booking_invitation',
    'Invitation à un créneau',
    COALESCE(v_host_name, 'Un membre') || ' vous invite à jouer le ' ||
      to_char(v_date, 'DD/MM') || ' à ' || to_char(v_start, 'HH24:MI'),
    '/booking/' || NEW.booking_id,
    jsonb_build_object('booking_id', NEW.booking_id, 'player_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_booking_invitation
  AFTER INSERT ON booking_players
  FOR EACH ROW EXECUTE FUNCTION notify_booking_invitation();

REVOKE EXECUTE ON FUNCTION notify_booking_invitation() FROM PUBLIC, anon, authenticated;

-- 5) Trigger : tournament_registrations status changes
CREATE OR REPLACE FUNCTION notify_tournament_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tname TEXT;
  v_link TEXT;
  v_admin_title TEXT;
  v_admin_body TEXT;
BEGIN
  -- Skip si pas de changement de statut
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_tname FROM tournaments WHERE id = NEW.tournament_id;
  v_link := '/tournaments/' || NEW.tournament_id;

  -- A) Réponse partenaire (UPDATE: pending_partner → pending_admin / cancelled)
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending_partner' THEN
    IF NEW.status = 'pending_admin' THEN
      INSERT INTO notifications (user_id, type, title, body, link, metadata)
      VALUES (NEW.player1_uid, 'tournament_partner_response',
        'Partenaire confirmé',
        COALESCE(NEW.player2_name, 'Votre partenaire') || ' a accepté de jouer avec vous au tournoi ' || v_tname,
        v_link,
        jsonb_build_object('registration_id', NEW.id, 'tournament_id', NEW.tournament_id));
    ELSIF NEW.status = 'cancelled' THEN
      INSERT INTO notifications (user_id, type, title, body, link, metadata)
      VALUES (NEW.player1_uid, 'tournament_partner_response',
        'Partenaire indisponible',
        COALESCE(NEW.player2_name, 'Votre partenaire') || ' a refusé l''invitation au tournoi ' || v_tname,
        v_link,
        jsonb_build_object('registration_id', NEW.id, 'tournament_id', NEW.tournament_id));
    END IF;
  END IF;

  -- B) Décision admin (pending_admin → approved / waitlist / cancelled)
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending_admin'
     AND NEW.status IN ('approved', 'waitlist', 'cancelled') THEN
    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.player1_uid, 'tournament_admin_decision',
      CASE NEW.status
        WHEN 'approved' THEN 'Inscription validée'
        WHEN 'waitlist' THEN 'Inscription en file d''attente'
        ELSE 'Inscription refusée'
      END,
      'Tournoi ' || v_tname ||
        CASE NEW.status
          WHEN 'approved' THEN ' — vous êtes confirmés.'
          WHEN 'waitlist' THEN ' — vous êtes en liste d''attente (#' || COALESCE(NEW.position::text, '?') || ').'
          ELSE ' — votre inscription a été refusée.'
        END,
      v_link,
      jsonb_build_object('registration_id', NEW.id, 'tournament_id', NEW.tournament_id, 'new_status', NEW.status)
    );
    -- Notifier player2 si membre (pas externe)
    IF NEW.player2_uid IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, link, metadata)
      VALUES (
        NEW.player2_uid, 'tournament_admin_decision',
        CASE NEW.status
          WHEN 'approved' THEN 'Inscription validée'
          WHEN 'waitlist' THEN 'Inscription en file d''attente'
          ELSE 'Inscription refusée'
        END,
        'Tournoi ' || v_tname ||
          CASE NEW.status
            WHEN 'approved' THEN ' — vous êtes confirmés.'
            WHEN 'waitlist' THEN ' — vous êtes en liste d''attente (#' || COALESCE(NEW.position::text, '?') || ').'
            ELSE ' — votre inscription a été refusée.'
          END,
        v_link,
        jsonb_build_object('registration_id', NEW.id, 'tournament_id', NEW.tournament_id, 'new_status', NEW.status)
      );
    END IF;
  END IF;

  -- C) Admin: nouvelle inscription à valider (entre dans pending_admin)
  IF NEW.status = 'pending_admin'
     AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status <> 'pending_admin')) THEN
    v_admin_title := 'Nouvelle inscription à valider';
    v_admin_body := 'Tournoi ' || v_tname || ' : ' || NEW.player1_name || ' & ' || NEW.player2_name;
    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    SELECT
      p.id, 'tournament_admin_review_required',
      v_admin_title, v_admin_body, '/admin/tournaments',
      jsonb_build_object('registration_id', NEW.id, 'tournament_id', NEW.tournament_id)
    FROM profiles p
    WHERE p.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_tournament_status_insert
  AFTER INSERT ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_tournament_status_change();

CREATE TRIGGER tr_notify_tournament_status_update
  AFTER UPDATE OF status ON tournament_registrations
  FOR EACH ROW EXECUTE FUNCTION notify_tournament_status_change();

REVOKE EXECUTE ON FUNCTION notify_tournament_status_change() FROM PUBLIC, anon, authenticated;

-- 6) pg_cron : confirmation 48h (toutes les heures)
CREATE OR REPLACE FUNCTION job_notify_tournament_confirmation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link, metadata)
  SELECT
    p.uid,
    'tournament_confirmation_required',
    'Confirmer ta participation',
    'Le tournoi ' || t.name || ' commence dans moins de 48h. Confirme ta participation.',
    '/my-tournaments',
    jsonb_build_object('registration_id', tr.id, 'tournament_id', tr.tournament_id)
  FROM tournament_registrations tr
  JOIN tournaments t ON t.id = tr.tournament_id
  CROSS JOIN LATERAL (
    SELECT unnest(ARRAY[tr.player1_uid, tr.player2_uid]) AS uid
  ) p
  WHERE tr.status = 'approved'
    AND p.uid IS NOT NULL
    AND t.confirmation_deadline IS NOT NULL
    AND t.confirmation_deadline <= NOW()
    AND t.date >= CURRENT_DATE
    AND CASE
      WHEN p.uid = tr.player1_uid THEN tr.player1_confirmed
      ELSE tr.player2_confirmed
    END = false
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.uid
        AND n.type = 'tournament_confirmation_required'
        AND n.metadata->>'registration_id' = tr.id::text
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION job_notify_tournament_confirmation() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'notify-tournament-confirmation',
  '0 * * * *',
  $$ SELECT job_notify_tournament_confirmation(); $$
);
