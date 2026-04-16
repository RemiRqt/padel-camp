-- =====================================================================
-- Migration 008 — Intégration TVA (produits, sessions, transactions)
-- =====================================================================
-- Objectif : permettre la déclaration TVA française.
-- Approche : prix existants = TTC, on ajoute tva_rate + ventilation
--            sur les transactions. Un trigger calcule amount_ht/amount_tva
--            automatiquement, donc aucune modification de debit_user()
--            ni de credit_user() n'est nécessaire.
-- =====================================================================

-- 1) Taux TVA session (global, dans club_config)
ALTER TABLE club_config
  ADD COLUMN IF NOT EXISTS tva_rate_session numeric(5,2) NOT NULL DEFAULT 20.00;

-- 2) Taux par défaut sur catégorie de produit
ALTER TABLE product_categories
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 20.00;

-- 3) Override optionnel sur produit (NULL = hérite de la catégorie)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NULL;

-- 4) Ventilation TVA sur les transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NULL,
  ADD COLUMN IF NOT EXISTS amount_ht numeric(10,2) NULL,
  ADD COLUMN IF NOT EXISTS amount_tva numeric(10,2) NULL;

-- Index pour les exports par taux
CREATE INDEX IF NOT EXISTS idx_transactions_tva_rate ON transactions(tva_rate);

-- =====================================================================
-- 5) Trigger BEFORE INSERT : calcule automatiquement tva_rate,
--    amount_ht et amount_tva lors de l'insertion d'une transaction.
--
--    Règles :
--      - credit          → taux 0 (recharge wallet = avance, pas de TVA
--                          à la collecte ; TVA sera prélevée à la
--                          consommation sur debit_*).
--      - debit_session   → club_config.tva_rate_session (défaut 20).
--      - debit_product   → products.tva_rate si défini, sinon
--                          product_categories.tva_rate (défaut 20).
--      - external_payment→ même logique produit si product_id, sinon 20.
--      - Si appelant a déjà fourni tva_rate / amount_ht / amount_tva,
--        on respecte ses valeurs (pas d'écrasement).
-- =====================================================================

CREATE OR REPLACE FUNCTION compute_transaction_tva()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rate numeric;
BEGIN
  -- Si le caller a fourni toute la ventilation, on ne touche à rien
  IF NEW.tva_rate IS NOT NULL
     AND NEW.amount_ht IS NOT NULL
     AND NEW.amount_tva IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Détermination du taux si absent
  IF NEW.tva_rate IS NULL THEN
    IF NEW.type = 'credit' THEN
      v_rate := 0;
    ELSIF NEW.type = 'debit_session' THEN
      SELECT tva_rate_session INTO v_rate FROM club_config LIMIT 1;
      v_rate := COALESCE(v_rate, 20);
    ELSIF NEW.type IN ('debit_product', 'external_payment') AND NEW.product_id IS NOT NULL THEN
      SELECT COALESCE(p.tva_rate, c.tva_rate, 20)
        INTO v_rate
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
       WHERE p.id = NEW.product_id;
      v_rate := COALESCE(v_rate, 20);
    ELSE
      v_rate := 20;
    END IF;
    NEW.tva_rate := v_rate;
  ELSE
    v_rate := NEW.tva_rate;
  END IF;

  -- Calcul HT/TVA à partir du montant TTC
  IF NEW.amount IS NOT NULL THEN
    IF v_rate = 0 THEN
      NEW.amount_ht  := NEW.amount;
      NEW.amount_tva := 0;
    ELSE
      NEW.amount_ht  := ROUND(NEW.amount / (1 + v_rate / 100), 2);
      NEW.amount_tva := ROUND(NEW.amount - NEW.amount_ht, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compute_transaction_tva_trigger ON transactions;
CREATE TRIGGER compute_transaction_tva_trigger
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION compute_transaction_tva();

-- =====================================================================
-- 6) Backfill des transactions existantes
--    (taux par défaut 20% sauf pour les crédits qui passent à 0%).
-- =====================================================================

UPDATE transactions
   SET tva_rate   = 0,
       amount_ht  = amount,
       amount_tva = 0
 WHERE tva_rate IS NULL
   AND type = 'credit'
   AND amount IS NOT NULL;

UPDATE transactions
   SET tva_rate   = 20.00,
       amount_ht  = ROUND(amount / 1.20, 2),
       amount_tva = ROUND(amount - (amount / 1.20), 2)
 WHERE tva_rate IS NULL
   AND amount IS NOT NULL;

-- =====================================================================
-- Vérifications post-migration :
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name IN ('products','product_categories','club_config','transactions')
--      AND column_name LIKE '%tva%' OR column_name IN ('amount_ht','amount_tva');
--
--   SELECT COUNT(*) FROM transactions WHERE amount_ht IS NULL;   -- doit être 0
--   SELECT type, COUNT(*), SUM(amount), SUM(amount_ht), SUM(amount_tva)
--     FROM transactions GROUP BY type;
-- =====================================================================
