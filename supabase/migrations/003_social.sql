-- ============================================
-- MIGRATION 003 : Social (amis + matchs)
-- ============================================

-- Table amis
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS friends_user_friend ON friends(user_id, friend_id);

-- Table matchs
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES profiles(id),
  player2_id UUID REFERENCES profiles(id),
  opponent1_id UUID REFERENCES profiles(id),
  opponent2_id UUID REFERENCES profiles(id),
  score_team1 TEXT NOT NULL, -- "6/4 7/5"
  score_team2 TEXT NOT NULL, -- "4/6 5/7"
  winner TEXT CHECK (winner IN ('team1', 'team2')) NOT NULL,
  date_played DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their friendships" ON friends;
CREATE POLICY "Users can manage their friendships" ON friends
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see their matches" ON matches;
CREATE POLICY "Users can see their matches" ON matches
  FOR SELECT USING (auth.uid() IN (player1_id, player2_id, opponent1_id, opponent2_id));
DROP POLICY IF EXISTS "Users can insert matches" ON matches;
CREATE POLICY "Users can insert matches" ON matches
  FOR INSERT WITH CHECK (auth.uid() IN (player1_id, player2_id));
