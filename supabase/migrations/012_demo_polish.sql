-- ============================================
-- 012_demo_polish : enrichissement données démo
-- ============================================
-- IDEMPOTENT : peut être ré-exécuté sans casser
-- Exécution : Supabase Studio SQL Editor sur le projet volranoojbqeramwldaf
-- Préfixe UUIDs membres démo : a2000000-...
-- Email domain : @demo.padelcamp.test
-- Conserve TOUS les membres existants et en ajoute 10 nouveaux.
-- L'admin réel rranquet@gmail.com est EXCLU des pools de tirage (résas, règlements, recharges, ventes).
-- ============================================

DO $$
DECLARE
  -- 10 nouveaux membres démo, UUIDs fixes pour idempotence
  demo_members UUID[] := ARRAY[
    'a2000000-0000-0000-0000-000000000001'::UUID,
    'a2000000-0000-0000-0000-000000000002'::UUID,
    'a2000000-0000-0000-0000-000000000003'::UUID,
    'a2000000-0000-0000-0000-000000000004'::UUID,
    'a2000000-0000-0000-0000-000000000005'::UUID,
    'a2000000-0000-0000-0000-000000000006'::UUID,
    'a2000000-0000-0000-0000-000000000007'::UUID,
    'a2000000-0000-0000-0000-000000000008'::UUID,
    'a2000000-0000-0000-0000-000000000009'::UUID,
    'a2000000-0000-0000-0000-000000000010'::UUID
  ];
  demo_first_names TEXT[] := ARRAY[
    'Léa','Hugo','Chloé','Nathan','Manon','Enzo','Inès','Tom','Jade','Raphaël'
  ];
  demo_last_names TEXT[] := ARRAY[
    'Lefevre','Mercier','Faure','Andre','Bonnet','Blanc','Guerin','Boyer','Garnier','Chevalier'
  ];
BEGIN
  -- Le contenu sera ajouté dans les tâches suivantes (membres → résas → règlements → recharges → ventes)
  RAISE NOTICE 'Stub OK, sera complété dans tâches 3-6';
END $$;
