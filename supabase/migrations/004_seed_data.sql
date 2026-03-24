-- ============================================
-- SEED DATA : 10 membres + réservations mars 2026
-- ============================================
-- ATTENTION : Exécuter dans Supabase SQL Editor
-- Les membres sont créés directement dans profiles (pas via auth)
-- Pour qu'ils puissent se connecter, il faudrait les créer via auth.signUp

-- 10 membres fictifs (on utilise gen_random_uuid pour les IDs)
-- On les insère dans profiles avec des UUIDs fixes pour pouvoir les référencer

DO $$
DECLARE
  m1 UUID := 'a1000000-0000-0000-0000-000000000001';
  m2 UUID := 'a1000000-0000-0000-0000-000000000002';
  m3 UUID := 'a1000000-0000-0000-0000-000000000003';
  m4 UUID := 'a1000000-0000-0000-0000-000000000004';
  m5 UUID := 'a1000000-0000-0000-0000-000000000005';
  m6 UUID := 'a1000000-0000-0000-0000-000000000006';
  m7 UUID := 'a1000000-0000-0000-0000-000000000007';
  m8 UUID := 'a1000000-0000-0000-0000-000000000008';
  m9 UUID := 'a1000000-0000-0000-0000-000000000009';
  m10 UUID := 'a1000000-0000-0000-0000-000000000010';
  members UUID[];
  d DATE;
  slot_start TIME;
  slot_end TIME;
  court TEXT;
  courts TEXT[] := ARRAY['terrain_1','terrain_2','terrain_3'];
  slot_starts TIME[] := ARRAY['09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30'];
  slot_ends   TIME[] := ARRAY['11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00'];
  prices DECIMAL[] := ARRAY[24,24,36,36,36,36,42,42,42]; -- prix par créneau approximatif
  day_of_week INT;
  member_idx INT;
  slot_idx INT;
  court_idx INT;
  booking_id UUID;
  should_book BOOLEAN;
  member_names TEXT[];
BEGIN
  -- Créer les 10 membres dans auth.users d'abord (nécessaire pour FK)
  -- On utilise une approche directe dans profiles en désactivant temporairement la FK
  -- Alternative : on insère directement si les users existent déjà

  -- Supprimer les anciens seeds si re-exécution
  DELETE FROM booking_players WHERE booking_id IN (SELECT id FROM bookings WHERE user_id IN (m1,m2,m3,m4,m5,m6,m7,m8,m9,m10));
  DELETE FROM transactions WHERE user_id IN (m1,m2,m3,m4,m5,m6,m7,m8,m9,m10) OR performed_by IN (m1,m2,m3,m4,m5,m6,m7,m8,m9,m10);
  DELETE FROM bookings WHERE user_id IN (m1,m2,m3,m4,m5,m6,m7,m8,m9,m10);
  DELETE FROM profiles WHERE id IN (m1,m2,m3,m4,m5,m6,m7,m8,m9,m10);

  -- Insérer dans auth.users (mot de passe = 'password123')
  INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at, raw_user_meta_data)
  VALUES
    (m1, '00000000-0000-0000-0000-000000000000', 'marie.dupont@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Marie Dupont"}'::jsonb),
    (m2, '00000000-0000-0000-0000-000000000000', 'lucas.robin@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Lucas Robin"}'::jsonb),
    (m3, '00000000-0000-0000-0000-000000000000', 'antoine.bernard@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Antoine Bernard"}'::jsonb),
    (m4, '00000000-0000-0000-0000-000000000000', 'camille.moreau@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Camille Moreau"}'::jsonb),
    (m5, '00000000-0000-0000-0000-000000000000', 'thomas.petit@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Thomas Petit"}'::jsonb),
    (m6, '00000000-0000-0000-0000-000000000000', 'julie.garcia@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Julie Garcia"}'::jsonb),
    (m7, '00000000-0000-0000-0000-000000000000', 'maxime.leroy@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Maxime Leroy"}'::jsonb),
    (m8, '00000000-0000-0000-0000-000000000000', 'emma.roux@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Emma Roux"}'::jsonb),
    (m9, '00000000-0000-0000-0000-000000000000', 'nicolas.fournier@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Nicolas Fournier"}'::jsonb),
    (m10, '00000000-0000-0000-0000-000000000000', 'sarah.martin@test.com', crypt('password123', gen_salt('bf')), NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"display_name":"Sarah Martin"}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

  -- Le trigger handle_new_user() va créer les profils automatiquement
  -- Mais au cas où on met à jour les profils avec soldes et licences
  -- Attendre que le trigger ait tourné :
  PERFORM pg_sleep(0.5);

  -- Mettre à jour les profils avec des soldes variés
  UPDATE profiles SET balance = 85.00,  balance_bonus = 13.00, phone = '06 10 00 00 01', license_number = '1234501' WHERE id = m1;
  UPDATE profiles SET balance = 120.50, balance_bonus = 28.00, phone = '06 10 00 00 02', license_number = '1234502' WHERE id = m2;
  UPDATE profiles SET balance = 45.00,  balance_bonus = 0.00,  phone = '06 10 00 00 03', license_number = '1234503' WHERE id = m3;
  UPDATE profiles SET balance = 200.00, balance_bonus = 51.00, phone = '06 10 00 00 04', license_number = '1234504' WHERE id = m4;
  UPDATE profiles SET balance = 15.00,  balance_bonus = 0.00,  phone = '06 10 00 00 05' WHERE id = m5;
  UPDATE profiles SET balance = 160.00, balance_bonus = 28.00, phone = '06 10 00 00 06', license_number = '1234506' WHERE id = m6;
  UPDATE profiles SET balance = 0.00,   balance_bonus = 0.00,  phone = '06 10 00 00 07', license_number = '1234507' WHERE id = m7;
  UPDATE profiles SET balance = 90.00,  balance_bonus = 13.00, phone = '06 10 00 00 08', license_number = '1234508' WHERE id = m8;
  UPDATE profiles SET balance = 55.00,  balance_bonus = 0.00,  phone = '06 10 00 00 09' WHERE id = m9;
  UPDATE profiles SET balance = 300.00, balance_bonus = 68.00, phone = '06 10 00 00 10', license_number = '1234510', role = 'admin' WHERE id = m10;

  members := ARRAY[m1,m2,m3,m4,m5,m6,m7,m8,m9,m10];
  member_names := ARRAY['Marie Dupont','Lucas Robin','Antoine Bernard','Camille Moreau','Thomas Petit','Julie Garcia','Maxime Leroy','Emma Roux','Nicolas Fournier','Sarah Martin'];

  -- Générer des réservations pour mars 2026 (1er au 31)
  -- 80% de remplissage = ~80% des 9 créneaux × 3 terrains × 31 jours
  FOR d IN SELECT generate_series('2026-03-01'::DATE, '2026-03-31'::DATE, '1 day'::INTERVAL)::DATE
  LOOP
    FOR court_idx IN 1..3 LOOP
      FOR slot_idx IN 1..9 LOOP
        -- 80% chance de réserver
        should_book := random() < 0.80;

        IF should_book THEN
          member_idx := floor(random() * 10)::INT + 1;
          court := courts[court_idx];
          slot_start := slot_starts[slot_idx];
          slot_end := slot_ends[slot_idx];
          booking_id := gen_random_uuid();

          -- Déterminer le prix selon jour/heure
          day_of_week := EXTRACT(DOW FROM d)::INT;
          -- dow: 0=dim, 1=lun..6=sam → notre format: 0=lun, 6=dim
          -- Conversion : (dow + 6) % 7

          INSERT INTO bookings (id, user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
          VALUES (
            booking_id,
            members[member_idx],
            member_names[member_idx],
            court,
            d,
            slot_start,
            slot_end,
            prices[slot_idx],
            'confirmed',
            CASE WHEN random() < 0.7 THEN 'paid' WHEN random() < 0.5 THEN 'partial' ELSE 'pending' END,
            d - (random() * 7)::INT * INTERVAL '1 day' + INTERVAL '10 hours'
          );

          -- Créer 4 joueurs pour la session
          INSERT INTO booking_players (booking_id, user_id, player_name, parts, payment_method, amount, payment_status)
          VALUES
            (booking_id, members[member_idx], member_names[member_idx], 1, 'balance', prices[slot_idx] / 4.0, CASE WHEN random() < 0.8 THEN 'paid' ELSE 'pending' END),
            (booking_id, members[((member_idx % 10) + 1)], member_names[((member_idx % 10) + 1)], 1, 'balance', prices[slot_idx] / 4.0, CASE WHEN random() < 0.6 THEN 'paid' ELSE 'pending' END),
            (booking_id, NULL, 'Place disponible', 1, 'balance', prices[slot_idx] / 4.0, 'pending'),
            (booking_id, NULL, 'Place disponible', 1, 'balance', prices[slot_idx] / 4.0, 'pending');
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Générer des transactions (crédits + débits sessions)
  -- Crédits pour chaque membre
  FOR member_idx IN 1..10 LOOP
    -- 2-3 recharges par membre
    FOR slot_idx IN 1..2 + floor(random() * 2)::INT LOOP
      INSERT INTO transactions (user_id, type, amount, description, performed_by, created_at)
      VALUES (
        members[member_idx],
        'credit',
        CASE WHEN random() < 0.5 THEN 100 ELSE 200 END,
        'Recharge compte',
        members[10], -- Sarah Martin (admin)
        '2026-03-01'::TIMESTAMPTZ + (random() * 30)::INT * INTERVAL '1 day' + (random() * 12 + 9)::INT * INTERVAL '1 hour'
      );
    END LOOP;

    -- Bonus pour certains
    IF random() < 0.6 THEN
      INSERT INTO transactions (user_id, type, amount, bonus_amount, description, performed_by, created_at)
      VALUES (
        members[member_idx],
        'credit_bonus',
        13,
        13,
        'Bonus formule (100€ → 113€)',
        members[10],
        '2026-03-01'::TIMESTAMPTZ + (random() * 30)::INT * INTERVAL '1 day'
      );
    END IF;

    -- Débits sessions
    FOR slot_idx IN 1..3 + floor(random() * 5)::INT LOOP
      INSERT INTO transactions (user_id, type, amount, bonus_used, real_used, description, performed_by, created_at)
      VALUES (
        members[member_idx],
        'debit_session',
        10.50,
        CASE WHEN random() < 0.3 THEN 10.50 ELSE 0 END,
        CASE WHEN random() < 0.3 THEN 0 ELSE 10.50 END,
        'Session terrain ' || (floor(random() * 3) + 1)::TEXT,
        members[member_idx],
        '2026-03-01'::TIMESTAMPTZ + (random() * 30)::INT * INTERVAL '1 day' + (random() * 12 + 9)::INT * INTERVAL '1 hour'
      );
    END LOOP;

    -- Quelques achats articles
    IF random() < 0.5 THEN
      INSERT INTO transactions (user_id, type, amount, description, performed_by, created_at)
      VALUES (
        members[member_idx],
        'debit_product',
        CASE WHEN random() < 0.5 THEN 3.50 ELSE 5.00 END,
        CASE WHEN random() < 0.5 THEN 'Coca-Cola' ELSE 'Eau minérale' END,
        members[10],
        '2026-03-01'::TIMESTAMPTZ + (random() * 30)::INT * INTERVAL '1 day'
      );
    END IF;
  END LOOP;

  -- Quelques paiements externes
  FOR slot_idx IN 1..8 LOOP
    INSERT INTO transactions (type, amount, description, performed_by, payment_method, created_at)
    VALUES (
      'external_payment',
      10.50,
      'Session — Joueur externe (CB)',
      members[10],
      'cb',
      '2026-03-01'::TIMESTAMPTZ + (random() * 30)::INT * INTERVAL '1 day'
    );
  END LOOP;

  -- Amitiés
  INSERT INTO friends (user_id, friend_id, status) VALUES
    (m1, m2, 'accepted'), (m1, m3, 'accepted'), (m1, m6, 'accepted'),
    (m2, m4, 'accepted'), (m2, m5, 'accepted'),
    (m3, m7, 'accepted'), (m3, m8, 'accepted'),
    (m4, m6, 'accepted'), (m4, m9, 'accepted'),
    (m5, m10, 'accepted'), (m6, m8, 'accepted'),
    (m7, m9, 'pending'), (m8, m10, 'pending')
  ON CONFLICT DO NOTHING;

  -- Matchs
  INSERT INTO matches (player1_id, player2_id, opponent1_id, opponent2_id, score_team1, score_team2, winner, date_played) VALUES
    (m1, m2, m3, m4, '6/4 6/3', '4/6 3/6', 'team1', '2026-03-05'),
    (m1, m6, m5, m7, '6/7 4/6', '7/6 6/4', 'team2', '2026-03-08'),
    (m2, m4, m1, m3, '6/2 6/4', '2/6 4/6', 'team1', '2026-03-10'),
    (m3, m8, m6, m9, '3/6 6/4 7/5', '6/3 4/6 5/7', 'team1', '2026-03-12'),
    (m5, m10, m2, m7, '6/1 6/3', '1/6 3/6', 'team1', '2026-03-15'),
    (m4, m6, m8, m1, '4/6 6/3 6/4', '6/4 3/6 4/6', 'team1', '2026-03-18'),
    (m1, m3, m2, m5, '6/4 3/6 7/6', '4/6 6/3 6/7', 'team1', '2026-03-20'),
    (m7, m9, m4, m10, '2/6 6/7', '6/2 7/6', 'team2', '2026-03-22'),
    (m2, m6, m3, m8, '6/3 6/4', '3/6 4/6', 'team1', '2026-03-24'),
    (m1, m4, m5, m9, '7/5 6/4', '5/7 4/6', 'team1', '2026-03-24')
  ON CONFLICT DO NOTHING;

  -- Tournois
  INSERT INTO tournaments (name, description, date, start_time, end_time, level, category, judge_arbiter, max_teams, status) VALUES
    ('Tournoi P250 Hommes Mars', 'Tournoi mensuel hommes niveau P250', '2026-03-28', '09:00', '18:00', 'P250', 'hommes', 'Jean-Marc Dupuis', 16, 'open'),
    ('Tournoi P100 Mixte', 'Tournoi mixte débutants/intermédiaires', '2026-04-05', '09:00', '17:00', 'P100', 'mixte', NULL, 12, 'open'),
    ('Open P500 Femmes', 'Open féminin', '2026-04-12', '10:00', '19:00', 'P500', 'femmes', 'Sophie Leclerc', 8, 'draft');

  -- Événements
  INSERT INTO events (name, description, date, start_time, end_time, is_public) VALUES
    ('Soirée lancement saison', 'Venez célébrer le début de la saison avec tapas et boissons offertes !', '2026-04-01', '19:00', '23:00', true),
    ('Stage padel débutants', '2 jours de stage intensif pour les débutants. Raquettes fournies.', '2026-04-10', '09:30', '12:30', true),
    ('Tournoi interne fun', 'Tournoi amical entre membres — pas de licence requise', '2026-03-29', '14:00', '18:00', true);

  -- Catégories produits + produits
  INSERT INTO product_categories (name, sort_order) VALUES
    ('Boissons', 1), ('Snacks', 2), ('Location', 3), ('Accessoires', 4)
  ON CONFLICT DO NOTHING;

  INSERT INTO products (category_id, name, price) VALUES
    ((SELECT id FROM product_categories WHERE name = 'Boissons' LIMIT 1), 'Coca-Cola', 3.50),
    ((SELECT id FROM product_categories WHERE name = 'Boissons' LIMIT 1), 'Eau minérale', 2.00),
    ((SELECT id FROM product_categories WHERE name = 'Boissons' LIMIT 1), 'Bière', 5.00),
    ((SELECT id FROM product_categories WHERE name = 'Boissons' LIMIT 1), 'Jus d''orange', 3.00),
    ((SELECT id FROM product_categories WHERE name = 'Snacks' LIMIT 1), 'Barre énergétique', 2.50),
    ((SELECT id FROM product_categories WHERE name = 'Snacks' LIMIT 1), 'Chips', 2.00),
    ((SELECT id FROM product_categories WHERE name = 'Location' LIMIT 1), 'Location raquette 1h30', 8.00),
    ((SELECT id FROM product_categories WHERE name = 'Location' LIMIT 1), 'Location balles (3)', 4.00),
    ((SELECT id FROM product_categories WHERE name = 'Accessoires' LIMIT 1), 'Surgrip', 5.00),
    ((SELECT id FROM product_categories WHERE name = 'Accessoires' LIMIT 1), 'Bandeau', 8.00)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed data generated: 10 members, ~670 bookings (80%% of March), transactions, friends, matches, tournaments, events, products';
END $$;
