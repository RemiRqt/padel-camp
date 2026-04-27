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
  -- ============================================
  -- 10 nouveaux membres dans auth.users (mot de passe = 'demo2026')
  -- Le trigger handle_new_user crée automatiquement un profile
  -- ============================================
  FOR i IN 1..10 LOOP
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, role, aud, created_at, updated_at, raw_user_meta_data
    )
    VALUES (
      demo_members[i],
      '00000000-0000-0000-0000-000000000000',
      lower(translate(demo_first_names[i], 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC'))
        || '.'
        || lower(translate(demo_last_names[i], 'éèêëàâäîïôöùûüçÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'eeeeaaaiioouuucEEEEAAAIIOOUUUC'))
        || '@demo.padelcamp.test',
      crypt('demo2026', gen_salt('bf')),
      NOW(),
      'authenticated',
      'authenticated',
      NOW() - (random() * 365)::INT * INTERVAL '1 day',
      NOW(),
      jsonb_build_object('display_name', demo_first_names[i] || ' ' || demo_last_names[i])
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;

  -- Mettre à jour les profils avec données démo cohérentes
  -- 9 membres standard + 1 admin démo (en plus des comptes existants)
  FOR i IN 1..10 LOOP
    UPDATE profiles SET
      display_name = demo_first_names[i] || ' ' || demo_last_names[i],
      phone = '+33 6 99 99 ' || lpad(((i*7) % 100)::TEXT, 2, '0') || ' ' || lpad(((i*13) % 100)::TEXT, 2, '0'),
      license_number = '90' || lpad((10000 + i)::TEXT, 5, '0'),
      balance = (50 + (i * 7) % 200)::DECIMAL,
      balance_bonus = ((i * 11) % 50)::DECIMAL,
      role = CASE
        WHEN i = 10 THEN 'admin'::user_role
        ELSE 'user'::user_role
      END
    WHERE id = demo_members[i];
  END LOOP;

  RAISE NOTICE 'Task 3 OK : 10 membres démo créés/mis à jour';
END $$;
