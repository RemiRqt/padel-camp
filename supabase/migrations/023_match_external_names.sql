-- ============================================
-- MIGRATION 023 : Noms d'adversaires externes
-- ============================================
-- Permet d'enregistrer un match avec un partenaire ou des adversaires
-- non-membres du club, en stockant juste leur nom.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS partner_name TEXT,
  ADD COLUMN IF NOT EXISTS opponent1_name TEXT,
  ADD COLUMN IF NOT EXISTS opponent2_name TEXT;
