# Démo mercredi — phase 1 : données fictives + light security pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer la base actuelle pour la démo de mercredi 29/04 — 30 membres fictifs supplémentaires, planning avril 70% + mai dégressif, règlements complets sur sessions passées, recharges, ventes POS, TVA variées — et passer un check sécurité rapide. Tout doit être sur `master` pour que `padel-camp-iota.vercel.app` soit présentable.

**Architecture :** Une seule migration SQL idempotente `012_demo_polish.sql`, mêmes patterns que `004_seed_data.sql` (DO block, `auth.users` + trigger `handle_new_user`, `crypt('password123', gen_salt('bf'))`). Exécutée manuellement dans Supabase SQL Editor. Le check sécurité = grep + lecture rapide, pas d'audit.

**Tech Stack :** PostgreSQL (PL/pgSQL), Supabase Studio SQL Editor, Bash pour le grep sécurité.

**Spec liée :** `docs/superpowers/specs/2026-04-27-demo-mercredi-design.md`

---

## File Structure

| Fichier | Rôle | Action |
|---|---|---|
| `supabase/migrations/012_demo_polish.sql` | Seed additionnel : 30 membres + résas + règlements + recharges + ventes POS | Créer |
| `supabase/migrations/013_demo_tva_variation.sql` | Diversifier les TVA des produits existants si nécessaire | Créer (conditionnel) |
| (lecture) `supabase/migrations/001_initial_schema.sql` | Référence des structures de tables | Lire |
| (lecture) `supabase/migrations/004_seed_data.sql` | Pattern SQL à réutiliser | Lire |
| (lecture) `supabase/migrations/010_admin_transactions.sql` | RPC `external_payment` à appeler | Lire |

---

## Task 1: Light security pass

**Files:**
- Modify: `.gitignore` si nécessaire
- Read: divers fichiers source

- [ ] **Step 1: Vérifier qu'aucune clé `service_role` Supabase n'est en clair dans le repo**

```bash
git ls-files | xargs grep -l 'service_role' 2>/dev/null
git ls-files | xargs grep -lE 'eyJ[A-Za-z0-9_-]{20,}' 2>/dev/null | grep -v '\.lock'
```

Attendu : aucun résultat hors `package-lock.json`. Si une clé apparaît dans un fichier source ou doc → la déplacer en variable d'env, retirer du repo, **rotater la clé sur Supabase dashboard**.

- [ ] **Step 2: Vérifier que les fichiers `.env*` sont ignorés**

```bash
cat .gitignore | grep -E '^\.env'
git ls-files | grep -E '^\.env'
```

Attendu : `.env`, `.env.local` (au moins) listés dans `.gitignore`. Aucun `.env*` ne doit apparaître dans `git ls-files`. Si un `.env` est tracké → `git rm --cached .env`, ajouter à `.gitignore`, **rotater toutes les clés présentes**.

- [ ] **Step 3: Vérifier que la RLS est activée sur toutes les tables publiques**

Aller dans Supabase Studio → Database → Tables. Pour chaque table de la colonne `public` (profiles, bookings, booking_players, transactions, tournaments, tournament_registrations, events, products, product_categories, pricing_rules, recharge_formulas, club_config, friendships), vérifier que **RLS est activée** (toggle vert en haut de la liste des policies).

Si une table n'a pas RLS → activer immédiatement. Si une table n'a aucune policy → noter dans un fichier scratch, à traiter dans l'audit complet (post-mercredi).

- [ ] **Step 4: Vérifier qu'aucun `select('*')` n'a été ajouté récemment**

```bash
git log --since="1 month" --diff-filter=A -p -- 'src/services/*.js' 2>/dev/null | grep -E "select\('\*'\)"
```

Attendu : aucun. Si présent → noter pour traitement ultérieur (sauf si dans un endroit critique pour la démo, auquel cas corriger).

- [ ] **Step 5: Commit (uniquement si modifications)**

```bash
git add .gitignore
git commit -m "Light security pass : .gitignore vérifié, aucune clé exposée"
```

Si rien n'a été modifié, sauter le commit.

---

## Task 2: Préparer le squelette de la migration 012

**Files:**
- Create: `supabase/migrations/012_demo_polish.sql`

- [ ] **Step 1: Créer le fichier avec en-tête + bloc DO et UUIDs des 30 nouveaux membres**

```sql
-- ============================================
-- 012_demo_polish : enrichissement données démo
-- ============================================
-- IDEMPOTENT : peut être ré-exécuté sans casser
-- Exécution : Supabase Studio SQL Editor sur le projet volranoojbqeramwldaf
-- Préfixe UUIDs membres démo : a2000000-...
-- Email domain : @demo.padelcamp.test
-- ============================================

DO $$
DECLARE
  -- 30 nouveaux membres démo, UUIDs fixes pour idempotence
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
    'a2000000-0000-0000-0000-000000000010'::UUID,
    'a2000000-0000-0000-0000-000000000011'::UUID,
    'a2000000-0000-0000-0000-000000000012'::UUID,
    'a2000000-0000-0000-0000-000000000013'::UUID,
    'a2000000-0000-0000-0000-000000000014'::UUID,
    'a2000000-0000-0000-0000-000000000015'::UUID,
    'a2000000-0000-0000-0000-000000000016'::UUID,
    'a2000000-0000-0000-0000-000000000017'::UUID,
    'a2000000-0000-0000-0000-000000000018'::UUID,
    'a2000000-0000-0000-0000-000000000019'::UUID,
    'a2000000-0000-0000-0000-000000000020'::UUID,
    'a2000000-0000-0000-0000-000000000021'::UUID,
    'a2000000-0000-0000-0000-000000000022'::UUID,
    'a2000000-0000-0000-0000-000000000023'::UUID,
    'a2000000-0000-0000-0000-000000000024'::UUID,
    'a2000000-0000-0000-0000-000000000025'::UUID,
    'a2000000-0000-0000-0000-000000000026'::UUID,
    'a2000000-0000-0000-0000-000000000027'::UUID,
    'a2000000-0000-0000-0000-000000000028'::UUID,
    'a2000000-0000-0000-0000-000000000029'::UUID,
    'a2000000-0000-0000-0000-000000000030'::UUID
  ];
  demo_first_names TEXT[] := ARRAY[
    'Léa','Hugo','Chloé','Nathan','Manon','Enzo','Inès','Tom','Jade','Raphaël',
    'Louise','Arthur','Alice','Gabriel','Rose','Liam','Emma','Adam','Mila','Léo',
    'Ambre','Noah','Anna','Maël','Eva','Sacha','Lola','Ethan','Zoé','Aaron'
  ];
  demo_last_names TEXT[] := ARRAY[
    'Lefevre','Mercier','Faure','Andre','Mercier','Blanc','Guerin','Boyer','Garnier','Chevalier',
    'Francois','Legrand','Gauthier','Garcia','Perrin','Robin','Clement','Morin','Nicolas','Henry',
    'Roussel','Mathieu','Gautier','Masson','Marchand','Duval','Denis','Dumont','Marie','Lemoine'
  ];
BEGIN
  -- Le contenu sera ajouté dans les tâches suivantes (membres → résas → règlements → recharges → ventes)
  RAISE NOTICE 'Stub OK, sera complété dans tâches 3-6';
END $$;
```

- [ ] **Step 2: Vérifier syntaxe — exécuter dans Supabase Studio**

Coller le bloc, exécuter. Doit afficher `NOTICE: Stub OK`. Pas d'erreur de syntaxe.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/012_demo_polish.sql
git commit -m "Demo polish : squelette migration 012 (30 membres démo prévus)"
```

---

## Task 3: Insertion des 30 membres dans `auth.users` + profils

**Files:**
- Modify: `supabase/migrations/012_demo_polish.sql`

- [ ] **Step 1: Ajouter le bloc INSERT auth.users dans le DO block (avant le RAISE NOTICE)**

Avant la ligne `RAISE NOTICE 'Stub OK...'`, remplacer par :

```sql
  -- ============================================
  -- 30 nouveaux membres dans auth.users (mot de passe = 'demo2026')
  -- Le trigger handle_new_user crée automatiquement un profile
  -- ============================================
  FOR i IN 1..30 LOOP
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, role, aud, created_at, updated_at, raw_user_meta_data
    )
    VALUES (
      demo_members[i],
      '00000000-0000-0000-0000-000000000000',
      lower(demo_first_names[i]) || '.' || lower(demo_last_names[i]) || '@demo.padelcamp.test',
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

  -- Laisser le trigger handle_new_user créer les profiles
  PERFORM pg_sleep(0.5);

  -- Mettre à jour les profils avec données démo cohérentes
  -- 27 membres standard + 2 admins/staff + 1 inactif (= 30 total)
  FOR i IN 1..30 LOOP
    UPDATE profiles SET
      display_name = demo_first_names[i] || ' ' || demo_last_names[i],
      first_name = demo_first_names[i],
      last_name = demo_last_names[i],
      phone = '+33 6 99 99 ' || lpad(((i*7) % 100)::TEXT, 2, '0') || ' ' || lpad(((i*13) % 100)::TEXT, 2, '0'),
      license_number = '90' || lpad((10000 + i)::TEXT, 5, '0'),
      balance = (50 + (i * 7) % 200)::DECIMAL,
      balance_bonus = ((i * 11) % 50)::DECIMAL,
      role = CASE
        WHEN i = 29 THEN 'admin'::user_role        -- 1 admin démo
        WHEN i = 30 THEN 'admin'::user_role        -- 1 admin démo
        ELSE 'member'::user_role
      END
    WHERE id = demo_members[i];
  END LOOP;
```

⚠️ Vérifier le nom exact du type enum `user_role` dans `001_initial_schema.sql` ; ajuster si différent. Vérifier aussi que la colonne `first_name`/`last_name` existe ou retirer si non (le seed 004 ne met que `display_name`).

- [ ] **Step 2: Exécuter dans Supabase SQL Editor**

Vérifier output : pas d'erreur, NOTICE `Stub OK` désormais absent.

- [ ] **Step 3: Vérifier la création**

```sql
SELECT count(*) FROM auth.users WHERE email LIKE '%@demo.padelcamp.test';
-- Attendu : 30

SELECT count(*) FROM profiles WHERE id::TEXT LIKE 'a2000000-%';
-- Attendu : 30

SELECT count(*) FROM profiles WHERE role = 'admin' AND id::TEXT LIKE 'a2000000-%';
-- Attendu : 2
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_demo_polish.sql
git commit -m "Demo polish : 30 membres démo (27 members + 2 admins + 1 inactif)"
```

---

## Task 4: Génération des réservations (avril 70% + mai dégressif)

**Files:**
- Modify: `supabase/migrations/012_demo_polish.sql`

- [ ] **Step 1: Lire `club_config` pour récupérer les créneaux et prix réels**

```sql
SELECT * FROM club_config LIMIT 1;
SELECT * FROM pricing_rules ORDER BY day_of_week, start_time LIMIT 30;
```

Noter les `slot_starts`, `slot_ends`, `prices` réels du club. Si la structure diffère du seed 004, adapter les arrays ci-dessous.

- [ ] **Step 2: Ajouter le bloc de génération des réservations dans le DO block**

À la suite du UPDATE profiles (avant le END $$;), insérer :

```sql
  -- ============================================
  -- Réservations avril 2026 (70%) + mai 2026 (dégressif)
  -- Pool de joueurs = anciens seeds (a1000000-*) + nouveaux (a2000000-*)
  -- ============================================
  DECLARE
    all_members UUID[];
    all_names TEXT[];
    courts TEXT[] := ARRAY['terrain_1','terrain_2','terrain_3'];
    slot_starts TIME[] := ARRAY['09:30','11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30'];
    slot_ends   TIME[] := ARRAY['11:00','12:30','14:00','15:30','17:00','18:30','20:00','21:30','23:00'];
    prices DECIMAL[] := ARRAY[24,24,36,36,36,36,42,42,42];
    d DATE;
    booking_id UUID;
    member_idx INT;
    court_idx INT;
    slot_idx INT;
    fill_rate FLOAT;
    week_of_may INT;
  BEGIN
    -- Construire le pool : 10 anciens + 30 nouveaux = 40 membres pour piochage
    SELECT array_agg(id ORDER BY id), array_agg(display_name ORDER BY id)
    INTO all_members, all_names
    FROM profiles
    WHERE id::TEXT LIKE 'a1000000-%' OR id::TEXT LIKE 'a2000000-%';

    -- Avril 2026 : 70% partout
    FOR d IN SELECT generate_series('2026-04-01'::DATE, '2026-04-30'::DATE, '1 day'::INTERVAL)::DATE LOOP
      FOR court_idx IN 1..3 LOOP
        FOR slot_idx IN 1..9 LOOP
          IF random() < 0.70 THEN
            member_idx := floor(random() * array_length(all_members, 1))::INT + 1;
            booking_id := gen_random_uuid();

            INSERT INTO bookings (id, user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
            VALUES (
              booking_id,
              all_members[member_idx],
              all_names[member_idx],
              courts[court_idx],
              d,
              slot_starts[slot_idx],
              slot_ends[slot_idx],
              prices[slot_idx],
              'confirmed',
              'pending',  -- sera mis à jour par les booking_players + trigger
              d - (random() * 5)::INT * INTERVAL '1 day' + INTERVAL '14 hours'
            )
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;

    -- Mai 2026 : dégressif S1=60% S2=45% S3=30% S4=15%
    FOR d IN SELECT generate_series('2026-05-01'::DATE, '2026-05-31'::DATE, '1 day'::INTERVAL)::DATE LOOP
      week_of_may := ((EXTRACT(DAY FROM d)::INT - 1) / 7) + 1;  -- 1..5
      fill_rate := CASE
        WHEN week_of_may = 1 THEN 0.60
        WHEN week_of_may = 2 THEN 0.45
        WHEN week_of_may = 3 THEN 0.30
        WHEN week_of_may = 4 THEN 0.15
        ELSE 0.10  -- résidu fin de mois
      END;

      FOR court_idx IN 1..3 LOOP
        FOR slot_idx IN 1..9 LOOP
          IF random() < fill_rate THEN
            member_idx := floor(random() * array_length(all_members, 1))::INT + 1;
            booking_id := gen_random_uuid();

            INSERT INTO bookings (id, user_id, user_name, court_id, date, start_time, end_time, price, status, payment_status, created_at)
            VALUES (
              booking_id,
              all_members[member_idx],
              all_names[member_idx],
              courts[court_idx],
              d,
              slot_starts[slot_idx],
              slot_ends[slot_idx],
              prices[slot_idx],
              'confirmed',
              'pending',
              d - (random() * 5)::INT * INTERVAL '1 day' + INTERVAL '14 hours'
            )
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END;
```

⚠️ Vérifier la structure de `bookings` dans `001_initial_schema.sql` (notamment colonnes `user_name`, `court_id` valeurs valides). Si l'enum/contrainte diffère, ajuster.

- [ ] **Step 3: Exécuter dans SQL Editor + vérifier**

```sql
SELECT date_trunc('month', date) AS mois, count(*)
FROM bookings
WHERE date BETWEEN '2026-04-01' AND '2026-05-31'
GROUP BY 1 ORDER BY 1;
-- Avril attendu : ~580 (70% × 30j × 3 terrains × 9 créneaux)
-- Mai attendu : ~290 (dégressif)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_demo_polish.sql
git commit -m "Demo polish : réservations avril 70% + mai dégressif"
```

---

## Task 5: Génération des règlements pour sessions passées (4 joueurs/résa)

**Files:**
- Modify: `supabase/migrations/012_demo_polish.sql`

- [ ] **Step 1: Lire les RPC `debit_user` et `external_payment` pour connaître la signature exacte**

```bash
grep -A 30 "create or replace function debit_user" supabase/migrations/*.sql
grep -A 30 "create or replace function external_payment" supabase/migrations/010_admin_transactions.sql
```

Noter les paramètres exacts (ordre, types). À adapter dans le bloc ci-dessous.

- [ ] **Step 2: Ajouter le bloc de génération des `booking_players` + règlements**

À la suite du bloc Task 4 (avant le `END $$;` final), insérer :

```sql
  -- ============================================
  -- Pour chaque session PASSÉE (date < CURRENT_DATE), générer 4 booking_players
  -- avec règlements ventilés : 70% wallet, 20% CB, 10% espèces
  -- ============================================
  DECLARE
    bk RECORD;
    all_members UUID[];
    p1 UUID; p2 UUID; p3 UUID; p4 UUID;
    share DECIMAL;
    pay_method TEXT;
    r FLOAT;
    admin_id UUID;
  BEGIN
    -- Pool de joueurs (mêmes que résas)
    SELECT array_agg(id ORDER BY id) INTO all_members
    FROM profiles
    WHERE id::TEXT LIKE 'a1000000-%' OR id::TEXT LIKE 'a2000000-%';

    -- Un admin pour les RPC external_payment (performed_by)
    SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

    FOR bk IN
      SELECT id, user_id, price, date, start_time
      FROM bookings
      WHERE date < CURRENT_DATE
        AND date >= '2026-04-01'  -- uniquement les nouvelles résas démo
        AND id NOT IN (SELECT booking_id FROM booking_players WHERE booking_id IS NOT NULL)
    LOOP
      share := round(bk.price / 4.0, 2);

      -- Tirer 4 joueurs distincts (organisateur + 3 invités)
      p1 := bk.user_id;
      LOOP p2 := all_members[floor(random() * array_length(all_members, 1))::INT + 1]; EXIT WHEN p2 != p1; END LOOP;
      LOOP p3 := all_members[floor(random() * array_length(all_members, 1))::INT + 1]; EXIT WHEN p3 NOT IN (p1, p2); END LOOP;
      LOOP p4 := all_members[floor(random() * array_length(all_members, 1))::INT + 1]; EXIT WHEN p4 NOT IN (p1, p2, p3); END LOOP;

      -- Pour chacun des 4 joueurs : insertion booking_player + règlement
      FOREACH p1 IN ARRAY ARRAY[p1, p2, p3, p4] LOOP
        r := random();
        pay_method := CASE
          WHEN r < 0.70 THEN 'wallet'
          WHEN r < 0.90 THEN 'card'
          ELSE 'cash'
        END;

        -- Insertion du booking_player en statut accepté
        INSERT INTO booking_players (booking_id, user_id, share_amount, payment_status, invitation_status, created_at)
        VALUES (bk.id, p1, share, 'paid', 'accepted', bk.date - INTERVAL '1 day');

        -- Génération de la transaction selon le mode
        IF pay_method = 'wallet' THEN
          PERFORM debit_user(
            p1,
            share,
            'session',
            'Part session ' || bk.date::TEXT || ' ' || bk.start_time::TEXT,
            bk.id
          );
        ELSE
          PERFORM external_payment(
            p1,
            share,
            'session',
            pay_method,
            'Part session ' || bk.date::TEXT || ' ' || bk.start_time::TEXT,
            bk.id,
            admin_id
          );
        END IF;
      END LOOP;
    END LOOP;
  END;
```

⚠️ **À ajuster impérativement** après la lecture du Step 1 : signatures exactes de `debit_user` et `external_payment`. Le bloc ci-dessus est un squelette, les noms d'arguments peuvent différer (ex: `_user_id`, `_amount`, etc.). Le `payment_method` enum/text peut aussi être 'card'/'cash'/'CB'/'especes' — vérifier dans `011_payment_method_consistency.sql`.

- [ ] **Step 3: Exécuter + vérifier**

```sql
SELECT count(*) FROM booking_players bp
JOIN bookings b ON b.id = bp.booking_id
WHERE b.date < CURRENT_DATE AND b.date >= '2026-04-01';
-- Attendu : ~ 4 × nb sessions passées avril

SELECT payment_method, count(*), sum(amount)
FROM transactions
WHERE type = 'session' AND created_at >= '2026-04-01'
GROUP BY 1;
-- Attendu : wallet ~70%, card ~20%, cash ~10%
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_demo_polish.sql
git commit -m "Demo polish : règlements 4 joueurs sur sessions passées (70/20/10)"
```

---

## Task 6: Recharges wallet + ventes POS

**Files:**
- Modify: `supabase/migrations/012_demo_polish.sql`

- [ ] **Step 1: Ajouter le bloc recharges**

Toujours dans le DO block, à la suite :

```sql
  -- ============================================
  -- Recharges : ~15-20 membres ont 1-3 recharges via formules existantes
  -- ============================================
  DECLARE
    formula RECORD;
    target_member UUID;
    nb_recharges INT;
    r FLOAT;
    pay_method TEXT;
    recharge_member_pool UUID[];
    admin_id UUID;
  BEGIN
    SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;

    -- 18 membres tirés au hasard parmi les 40
    SELECT array_agg(id) INTO recharge_member_pool
    FROM (
      SELECT id FROM profiles
      WHERE id::TEXT LIKE 'a1000000-%' OR id::TEXT LIKE 'a2000000-%'
      ORDER BY random()
      LIMIT 18
    ) sub;

    FOREACH target_member IN ARRAY recharge_member_pool LOOP
      nb_recharges := 1 + floor(random() * 3)::INT;  -- 1 à 3 recharges
      FOR i IN 1..nb_recharges LOOP
        -- Tirer une formule au hasard
        SELECT id, amount, bonus INTO formula
        FROM recharge_formulas
        ORDER BY random()
        LIMIT 1;

        r := random();
        pay_method := CASE
          WHEN r < 0.50 THEN 'card'
          WHEN r < 0.90 THEN 'cash'
          ELSE 'transfer'
        END;

        -- credit_user gère solde + bonus + transaction
        PERFORM credit_user(
          target_member,
          formula.amount,
          formula.bonus,
          pay_method,
          'Recharge formule (démo)',
          admin_id
        );
      END LOOP;
    END LOOP;
  END;
```

⚠️ **Vérifier la signature exacte de `credit_user`** (cf `001_initial_schema.sql`). Vérifier aussi les colonnes `recharge_formulas` (`amount`, `bonus`, ou autre nommage).

- [ ] **Step 2: Ajouter le bloc ventes POS**

À la suite :

```sql
  -- ============================================
  -- Ventes POS : 2-5 ventes/jour sur la période avril/mai (passé uniquement)
  -- ============================================
  DECLARE
    d DATE;
    nb_sales INT;
    prod RECORD;
    member_idx INT;
    all_members UUID[];
    pay_method TEXT;
    r FLOAT;
    qty INT;
    admin_id UUID;
  BEGIN
    SELECT id INTO admin_id FROM profiles WHERE role = 'admin' LIMIT 1;
    SELECT array_agg(id) INTO all_members
    FROM profiles WHERE id::TEXT LIKE 'a1000000-%' OR id::TEXT LIKE 'a2000000-%';

    FOR d IN SELECT generate_series('2026-04-01'::DATE, CURRENT_DATE - 1, '1 day'::INTERVAL)::DATE LOOP
      nb_sales := 2 + floor(random() * 4)::INT;  -- 2 à 5 ventes
      FOR i IN 1..nb_sales LOOP
        SELECT id, name, price INTO prod
        FROM products
        WHERE active = true
        ORDER BY random()
        LIMIT 1;

        qty := 1 + floor(random() * 2)::INT;  -- 1 ou 2 unités
        member_idx := floor(random() * array_length(all_members, 1))::INT + 1;

        r := random();
        pay_method := CASE
          WHEN r < 0.60 THEN 'wallet'
          WHEN r < 0.85 THEN 'card'
          ELSE 'cash'
        END;

        IF pay_method = 'wallet' THEN
          PERFORM debit_user(
            all_members[member_idx],
            prod.price * qty,
            'product',
            qty || 'x ' || prod.name,
            NULL
          );
        ELSE
          PERFORM external_payment(
            all_members[member_idx],
            prod.price * qty,
            'product',
            pay_method,
            qty || 'x ' || prod.name,
            NULL,
            admin_id
          );
        END IF;
      END LOOP;
    END LOOP;
  END;
```

⚠️ Vérifier que la table `products` a bien les colonnes `id`, `name`, `price`, `active`. Adapter si différent.

- [ ] **Step 3: Exécuter + vérifier**

```sql
SELECT type, payment_method, count(*), sum(amount)
FROM transactions
WHERE created_at >= '2026-04-01'
GROUP BY 1, 2 ORDER BY 1, 2;
-- Doit avoir des lignes pour : recharge×3 méthodes, session×3 méthodes, product×3 méthodes
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_demo_polish.sql
git commit -m "Demo polish : recharges wallet + ventes POS sur la période"
```

---

## Task 7: Diversifier les TVA dans `products` si besoin

**Files:**
- Create: `supabase/migrations/013_demo_tva_variation.sql` (conditionnel)

- [ ] **Step 1: Vérifier la diversité actuelle des TVA**

```sql
SELECT vat_rate, count(*) FROM products GROUP BY 1 ORDER BY 1;
```

Si **3 valeurs au moins** existent (ex : 5.5, 10, 20) → **sauter Task 7**, passer à Task 8.

Si une seule TVA → continuer.

- [ ] **Step 2: Créer la migration de variation**

```sql
-- supabase/migrations/013_demo_tva_variation.sql
-- Diversifier les TVA pour que le rapport financier ait des lignes 5.5/10/20
UPDATE products SET vat_rate = 5.5
WHERE category_id IN (SELECT id FROM product_categories WHERE name ILIKE '%boisson%' OR name ILIKE '%aliment%' OR name ILIKE '%snack%');

UPDATE products SET vat_rate = 10
WHERE category_id IN (SELECT id FROM product_categories WHERE name ILIKE '%location%' OR name ILIKE '%service%');

UPDATE products SET vat_rate = 20
WHERE category_id IN (SELECT id FROM product_categories WHERE name ILIKE '%materiel%' OR name ILIKE '%equip%' OR name ILIKE '%vetement%' OR name ILIKE '%vente%');

-- Fallback : si les noms de catégories ne matchent pas, mettre tout à 20 par défaut
UPDATE products SET vat_rate = 20 WHERE vat_rate IS NULL;
```

⚠️ Vérifier le nom exact de la colonne TVA dans `products` via `008_tva.sql`. Adapter `vat_rate` si nécessaire (peut-être `tva` ou `vat`).

- [ ] **Step 3: Exécuter + vérifier**

```sql
SELECT vat_rate, count(*) FROM products GROUP BY 1 ORDER BY 1;
-- Attendu : au moins 3 lignes (5.5, 10, 20)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/013_demo_tva_variation.sql
git commit -m "Demo polish : diversifier TVA produits (5.5/10/20)"
```

---

## Task 8: Smoke test complet de la démo

**Files:** aucun (tests manuels dans le navigateur)

- [ ] **Step 1: Démarrer le dev server local**

```bash
npm run dev
```

Ouvrir `http://localhost:5173`.

- [ ] **Step 2: Login avec un admin démo**

Email : `lola.duval@demo.padelcamp.test` (ou un des 2 admins démo, vérifier le 29ème ou 30ème nom dans le seed)
Password : `demo2026`

Si échec : vérifier dans Supabase Studio Auth qu'un utilisateur a été créé. Si pas de user → relancer le seed Task 3.

- [ ] **Step 3: Parcours admin — vérifications visuelles**

- [ ] `/admin` : KPIs affichent des nombres > 0 (résas, CA, membres)
- [ ] `/admin/calendar` : avril plein, mai dégressif visible
- [ ] `/admin/members` : 40+ membres (10 anciens + 30 nouveaux)
- [ ] `/admin/financial-export` :
  - Sélectionner période 01/04 → 27/04
  - 4 KPIs affichés (Sessions, Articles, Rechargements, Total)
  - Ventilation wallet/CB/espèces visible
  - Cliquer Excel → fichier téléchargé avec les bons onglets
  - Cliquer PDF → fichier téléchargé lisible

- [ ] **Step 4: Parcours user — vérifications visuelles**

Logout, login avec un membre standard (ex: `lea.lefevre@demo.padelcamp.test`, password `demo2026`).

- [ ] `/dashboard` : solde affiché, prochaines résas, transactions récentes
- [ ] `/booking` : grille 3 terrains, créneaux libres et occupés visibles pour mai
- [ ] `/profile` : licence FFT visible, téléphone visible

- [ ] **Step 5: Si bugs détectés**

Noter dans un fichier scratch `docs/test-plans/2026-04-27-demo-smoke-test.md`. Bugs critiques (page blanche, crash, données absurdes) → corriger immédiatement. Bugs cosmétiques → différer post-mercredi.

- [ ] **Step 6: Pas de commit (smoke test = lecture, pas d'écriture sauf bugfix)**

Si bugfix appliqué : commit normal avec message `Fix: <description>`.

---

## Task 9: Push final + freeze

**Files:** aucun (opérations git + Vercel)

- [ ] **Step 1: Vérifier git status propre**

```bash
git status
```

Doit afficher : `nothing to commit, working tree clean` (modulo le smoke test).

- [ ] **Step 2: Push sur master**

```bash
git push origin master
```

Vercel auto-déploie. Attendre la fin du build.

- [ ] **Step 3: Smoke test sur l'URL prod**

Ouvrir `https://padel-camp-iota.vercel.app`. Refaire les vérifications de Task 8 (login admin + user).

Si KO : c'est CRITIQUE. Investiguer.

- [ ] **Step 4: Freeze**

Annoncer dans le journal de bord : `2026-04-28 22:00 — DEMO FROZEN, no push until 2026-04-29 noon`.

Aucune commande, juste un engagement personnel + ce commit final.

- [ ] **Step 5: Commit du tag de freeze (optionnel mais recommandé)**

```bash
git tag -a demo-frozen-2026-04-29 -m "Démo figée pour présentation au club"
git push origin demo-frozen-2026-04-29
```

---

## Self-Review

**Spec coverage :**
- §3.1.1 (30 membres) → Task 3 ✓
- §3.1.2 (résas avril 70% + mai dégressif) → Task 4 ✓
- §3.1.3 (règlements sessions passées 70/20/10) → Task 5 ✓
- §3.1.4 (recharges) → Task 6 ✓
- §3.1.5 (articles + TVA variées) → Task 6 + Task 7 ✓
- §3.2 (light security pass) → Task 1 ✓
- §3.3 (bugs au fil de l'eau) → Task 8 (smoke test) + retour utilisateur ✓
- §3.4 (mercredi matin) → Task 9 (freeze) ✓

**Placeholders :** quelques ⚠️ subsistent dans Tasks 3/4/5/6/7 indiquant des **vérifications de signature/colonnes** à faire en lisant les migrations existantes. Ce ne sont pas des placeholders d'implémentation mais des points d'attention. Le pattern à suivre est documenté dans `004_seed_data.sql`.

**Type consistency :** UUIDs `a2000000-*` cohérents Tasks 2-6. Pool de membres `a1000000-* + a2000000-*` cohérent dans tous les SELECT array_agg. Nom de la colonne TVA marqué `vat_rate` dans Tasks 6 et 7 (à confirmer ensemble lors de l'exécution Task 7 step 1).

**Scope :** plan focalisé sur Phase 1 uniquement. Phase 2 (split master/dev + cadre de dev) fera l'objet d'un plan séparé après mercredi.
