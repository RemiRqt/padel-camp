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

-- ============================================
-- Task 4 : réservations avril 2026 (70%) + mai 2026 (dégressif)
-- Pool joueurs = tous les profils sauf rranquet@gmail.com
-- Idempotent : skip si des bookings existent déjà pour les membres a2000000-* sur avril
-- ============================================
DO $$
DECLARE
  all_members UUID[];
  all_names TEXT[];
  courts TEXT[] := ARRAY['terrain_1','terrain_2','terrain_3'];
  slot_starts TIME[] := ARRAY['09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30']::TIME[];
  slot_ends   TIME[] := ARRAY['11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00']::TIME[];
  prices DECIMAL[] := ARRAY[24,24,36,36,36,36,42,42,42];
  d DATE;
  member_idx INT;
  court_idx INT;
  slot_idx INT;
  fill_rate FLOAT;
  week_of_may INT;
  total_inserted INT := 0;
BEGIN
  -- Idempotence : si on a déjà beaucoup de bookings sur avril, skip tout le bloc
  IF (SELECT count(*) FROM bookings WHERE date BETWEEN '2026-04-01' AND '2026-04-30') > 100 THEN
    RAISE NOTICE 'Task 4 SKIP : bookings démo déjà présents (avril déjà rempli)';
    RETURN;
  END IF;

  -- Pool : tous les membres sauf l'admin réel
  SELECT array_agg(id ORDER BY id), array_agg(display_name ORDER BY id)
  INTO all_members, all_names
  FROM profiles
  WHERE id NOT IN (SELECT id FROM auth.users WHERE email = 'rranquet@gmail.com');

  IF array_length(all_members, 1) IS NULL OR array_length(all_members, 1) = 0 THEN
    RAISE EXCEPTION 'Pool de membres vide, abandon';
  END IF;

  -- Avril 2026 : 70% partout
  FOR d IN SELECT generate_series('2026-04-01'::DATE, '2026-04-30'::DATE, '1 day'::INTERVAL)::DATE LOOP
    FOR court_idx IN 1..3 LOOP
      FOR slot_idx IN 1..9 LOOP
        IF random() < 0.70 THEN
          member_idx := floor(random() * array_length(all_members, 1))::INT + 1;
          INSERT INTO bookings (user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
          VALUES (
            all_members[member_idx],
            all_names[member_idx],
            courts[court_idx],
            d,
            slot_starts[slot_idx],
            slot_ends[slot_idx],
            prices[slot_idx],
            'confirmed',
            'pending',
            (d - (random() * 5)::INT)::TIMESTAMPTZ + INTERVAL '14 hours'
          );
          total_inserted := total_inserted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Mai 2026 : dégressif S1=60% S2=45% S3=30% S4=15% (S5 résidu 10%)
  FOR d IN SELECT generate_series('2026-05-01'::DATE, '2026-05-31'::DATE, '1 day'::INTERVAL)::DATE LOOP
    week_of_may := ((EXTRACT(DAY FROM d)::INT - 1) / 7) + 1;
    fill_rate := CASE
      WHEN week_of_may = 1 THEN 0.60
      WHEN week_of_may = 2 THEN 0.45
      WHEN week_of_may = 3 THEN 0.30
      WHEN week_of_may = 4 THEN 0.15
      ELSE 0.10
    END;

    FOR court_idx IN 1..3 LOOP
      FOR slot_idx IN 1..9 LOOP
        IF random() < fill_rate THEN
          member_idx := floor(random() * array_length(all_members, 1))::INT + 1;
          INSERT INTO bookings (user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
          VALUES (
            all_members[member_idx],
            all_names[member_idx],
            courts[court_idx],
            d,
            slot_starts[slot_idx],
            slot_ends[slot_idx],
            prices[slot_idx],
            'confirmed',
            'pending',
            (d - (random() * 5)::INT)::TIMESTAMPTZ + INTERVAL '14 hours'
          );
          total_inserted := total_inserted + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Task 4 OK : % bookings insérés (avril 70%% + mai dégressif)', total_inserted;
END $$;
