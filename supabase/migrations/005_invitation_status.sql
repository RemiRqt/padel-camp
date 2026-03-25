-- ============================================
-- MIGRATION 005 : Invitation status sur booking_players
-- Un membre invité doit accepter et choisir son paiement
-- ============================================

-- Ajouter le statut d'invitation
ALTER TABLE booking_players
  ADD COLUMN IF NOT EXISTS invitation_status TEXT DEFAULT 'accepted'
    CHECK (invitation_status IN ('pending', 'accepted', 'declined'));

-- Le réservant (slot 1) et les joueurs déjà assignés sont "accepted" par défaut
-- Les nouveaux invités membres seront "pending"

-- RLS : un joueur peut modifier sa propre ligne (accepter invitation + choisir paiement)
CREATE POLICY "BookingPlayers: player updates own row"
  ON booking_players FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS : un user authentifié peut insérer (pour inviter)
CREATE POLICY "BookingPlayers: auth user inserts"
  ON booking_players FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
