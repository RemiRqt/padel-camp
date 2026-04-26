-- Empêche les utilisateurs de cibler le compte admin via API directe.
-- Filtres front-end + RLS = défense en profondeur. Avant cette migration,
-- un user qui devinerait l'UUID admin pouvait :
--   • envoyer une demande d'ami (friends)
--   • inviter l'admin sur une réservation (booking_players)
--   • inscrire l'admin comme partenaire de tournoi (tournament_registrations)
--   • enregistrer un match avec l'admin (matches)

-- Helper : est-ce que cet UUID appartient à un compte admin ?
CREATE OR REPLACE FUNCTION is_user_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM profiles WHERE id = uid), false);
$$;

-- 1. friends : interdire à un user d'envoyer une demande à l'admin
DROP POLICY IF EXISTS "Users can manage their friendships" ON friends;
CREATE POLICY "Users can manage their friendships" ON friends
  FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = friend_id OR is_admin())
  WITH CHECK (
    is_admin()
    OR (
      auth.uid() = user_id
      AND NOT is_user_admin(friend_id)
    )
  );

-- 2. friendships (table legacy de 001, garder par défense en profondeur)
DROP POLICY IF EXISTS "Friends: user gère les siens" ON friendships;
CREATE POLICY "Friends: user gère les siens" ON friendships
  FOR ALL
  USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (
    is_admin()
    OR (
      auth.uid() = user_id
      AND NOT is_user_admin(friend_id)
    )
  );

-- 3. booking_players : bloquer l'invitation d'un admin comme joueur
DROP POLICY IF EXISTS "BookingPlayers: user insère" ON booking_players;
CREATE POLICY "BookingPlayers: user insère" ON booking_players
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (user_id IS NULL OR NOT is_user_admin(user_id) OR is_admin())
  );

-- 4. matches : bloquer un match qui implique l'admin
DROP POLICY IF EXISTS "Users can insert matches" ON matches;
CREATE POLICY "Users can insert matches" ON matches
  FOR INSERT
  WITH CHECK (
    is_admin()
    OR (
      auth.uid() IN (player1_id, player2_id)
      AND NOT is_user_admin(player1_id)
      AND (player2_id IS NULL OR NOT is_user_admin(player2_id))
      AND (opponent1_id IS NULL OR NOT is_user_admin(opponent1_id))
      AND (opponent2_id IS NULL OR NOT is_user_admin(opponent2_id))
    )
  );

-- 5. tournament_registrations : bloquer l'inscription qui désigne admin comme partenaire
DROP POLICY IF EXISTS "Registrations: user s'inscrit" ON tournament_registrations;
CREATE POLICY "Registrations: user s'inscrit" ON tournament_registrations
  FOR INSERT
  WITH CHECK (
    auth.uid() = player1_uid
    AND NOT is_user_admin(player1_uid)
    AND (player2_uid IS NULL OR NOT is_user_admin(player2_uid))
  );
