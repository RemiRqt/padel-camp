-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE cancelled_by_type AS ENUM ('user', 'admin');
CREATE TYPE transaction_type AS ENUM ('credit', 'credit_bonus', 'debit_session', 'debit_product', 'refund', 'external_payment');
CREATE TYPE payment_method AS ENUM ('balance', 'cb', 'cash', 'mixed');
CREATE TYPE tournament_status AS ENUM ('draft', 'open', 'full', 'closed', 'cancelled', 'completed');
CREATE TYPE tournament_category AS ENUM ('hommes', 'femmes', 'mixte');
CREATE TYPE tournament_level AS ENUM ('P25', 'P50', 'P100', 'P250', 'P500', 'P1000', 'P2000');
CREATE TYPE registration_status AS ENUM ('pending_partner', 'pending_admin', 'approved', 'waitlist', 'confirmed', 'cancelled');

-- ============================================
-- TABLE : club_config (document unique)
-- ============================================
CREATE TABLE club_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Padel Camp Achères',
    logo_url TEXT,
    address TEXT NOT NULL DEFAULT '10 Rue des Communes, 78260 Achères',
    phone TEXT NOT NULL DEFAULT '01 34 01 58 48',
    description TEXT DEFAULT 'Complexe de padel avec bar & shop',
    instagram_url TEXT DEFAULT 'https://www.instagram.com/padel_campacheres/',
    courts_count INTEGER NOT NULL DEFAULT 3,
    court_names TEXT[] NOT NULL DEFAULT ARRAY['Terrain 1', 'Terrain 2', 'Terrain 3'],
    slot_duration INTEGER NOT NULL DEFAULT 90, -- en minutes
    open_days INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=lun, 6=dim
    open_time TIME NOT NULL DEFAULT '09:30',
    close_time TIME NOT NULL DEFAULT '23:00',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : pricing_rules
-- ============================================
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL, -- "Heure creuse", "Heure pleine", "Premium"
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    days INTEGER[] NOT NULL, -- [0,1,2,3,4] = lun-ven
    price_per_slot DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : recharge_formulas
-- ============================================
CREATE TABLE recharge_formulas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount_paid DECIMAL(10,2) NOT NULL,      -- montant payé par le membre
    amount_credited DECIMAL(10,2) NOT NULL,  -- montant total crédité
    bonus DECIMAL(10,2) GENERATED ALWAYS AS (amount_credited - amount_paid) STORED, -- auto-calculé
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : profiles (extension de auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role user_role NOT NULL DEFAULT 'user',
    balance DECIMAL(10,2) NOT NULL DEFAULT 0, -- solde réel (crédits payés)
    balance_bonus DECIMAL(10,2) NOT NULL DEFAULT 0, -- solde bonus (offerts via formules)
    license_number TEXT, -- numéro licence FFT (obligatoire pour tournois)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : friendships (v2)
-- ============================================
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- ============================================
-- TABLE : bookings
-- ============================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    user_name TEXT NOT NULL, -- dénormalisé
    court_id TEXT NOT NULL, -- "terrain_1", "terrain_2", "terrain_3"
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status booking_status NOT NULL DEFAULT 'confirmed',
    cancelled_by cancelled_by_type,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : booking_players (joueurs affectés à un créneau)
-- ============================================
CREATE TABLE booking_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id), -- NULL si joueur externe
    player_name TEXT NOT NULL,
    parts INTEGER NOT NULL DEFAULT 1, -- nombre de parts
    payment_method payment_method NOT NULL DEFAULT 'balance',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- montant débité/payé
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : transactions
-- ============================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id), -- NULL si paiement externe pur
    type transaction_type NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    bonus_amount DECIMAL(10,2) DEFAULT 0, -- part bonus dans le crédit
    bonus_used DECIMAL(10,2) DEFAULT 0, -- montant débité sur balance_bonus
    real_used DECIMAL(10,2) DEFAULT 0, -- montant débité sur balance réel
    description TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES profiles(id), -- UID opérateur
    booking_id UUID REFERENCES bookings(id),
    product_id UUID, -- référence article (ajout FK après création table)
    formula_amount_paid DECIMAL(10,2), -- si recharge via formule
    formula_amount_credited DECIMAL(10,2),
    formula_bonus DECIMAL(10,2),
    parts_count INTEGER DEFAULT 1,
    payment_method payment_method,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : tournaments
-- ============================================
CREATE TABLE tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    level tournament_level NOT NULL,
    category tournament_category NOT NULL,
    judge_arbiter TEXT, -- nom du JA
    max_teams INTEGER NOT NULL,
    registration_deadline TIMESTAMPTZ,
    confirmation_deadline TIMESTAMPTZ, -- 48h avant (auto-calculé)
    status tournament_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : tournament_registrations
-- ============================================
CREATE TABLE tournament_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    -- Joueur 1 (inscripteur)
    player1_uid UUID NOT NULL REFERENCES profiles(id),
    player1_name TEXT NOT NULL,
    player1_license TEXT NOT NULL,
    -- Joueur 2 (partenaire, membre ou externe)
    player2_uid UUID REFERENCES profiles(id), -- NULL si externe
    player2_name TEXT NOT NULL,
    player2_license TEXT NOT NULL,
    player2_is_external BOOLEAN NOT NULL DEFAULT false,
    -- Statut
    status registration_status NOT NULL DEFAULT 'pending_partner',
    position INTEGER, -- position file d'attente (NULL si pas waitlist)
    player1_confirmed BOOLEAN DEFAULT false, -- confirmation 48h
    player2_confirmed BOOLEAN DEFAULT false,
    admin_validated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : events
-- ============================================
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    image_url TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : product_categories
-- ============================================
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- "Boissons", "Location", "Matériel", "Vêtements"
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE : products
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- "Coca-Cola", "Location raquette 1h"
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter FK manquante sur transactions
ALTER TABLE transactions ADD CONSTRAINT fk_product FOREIGN KEY (product_id) REFERENCES products(id);

-- ============================================
-- INDEX pour les requêtes fréquentes
-- ============================================
CREATE INDEX idx_bookings_date_court ON bookings(date, court_id) WHERE status = 'confirmed';
CREATE INDEX idx_bookings_user ON bookings(user_id, date DESC);
CREATE INDEX idx_transactions_user ON transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type, created_at DESC);
CREATE INDEX idx_tournaments_status_date ON tournaments(status, date);
CREATE INDEX idx_registrations_tournament ON tournament_registrations(tournament_id, created_at ASC);
CREATE INDEX idx_registrations_player1 ON tournament_registrations(player1_uid, created_at DESC);
CREATE INDEX idx_registrations_player2 ON tournament_registrations(player2_uid, created_at DESC);
CREATE INDEX idx_events_public ON events(is_public, date) WHERE is_public = true;
CREATE INDEX idx_products_category ON products(category_id) WHERE is_active = true;

-- ============================================
-- TRIGGER : auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_club_config_updated_at BEFORE UPDATE ON club_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_tournaments_updated_at BEFORE UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_registrations_updated_at BEFORE UPDATE ON tournament_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER : créer profil automatiquement à l'inscription
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, display_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- TRIGGER : auto-calculer confirmation_deadline (48h avant)
-- ============================================
CREATE OR REPLACE FUNCTION set_confirmation_deadline()
RETURNS TRIGGER AS $$
BEGIN
    NEW.confirmation_deadline = (NEW.date + NEW.start_time) - INTERVAL '48 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_tournament_deadline BEFORE INSERT OR UPDATE ON tournaments FOR EACH ROW EXECUTE FUNCTION set_confirmation_deadline();

-- ============================================
-- FUNCTION : logique de débit (bonus first)
-- ============================================
CREATE OR REPLACE FUNCTION debit_user(
    p_user_id UUID,
    p_amount DECIMAL,
    p_description TEXT,
    p_performed_by UUID,
    p_type transaction_type,
    p_booking_id UUID DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_parts_count INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
    v_balance DECIMAL;
    v_balance_bonus DECIMAL;
    v_bonus_used DECIMAL := 0;
    v_real_used DECIMAL := 0;
    v_result JSON;
BEGIN
    -- Récupérer soldes actuels
    SELECT balance, balance_bonus INTO v_balance, v_balance_bonus
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    -- Vérifier solde suffisant
    IF (v_balance + v_balance_bonus) < p_amount THEN
        RAISE EXCEPTION 'Solde insuffisant: %.2f disponible, %.2f demandé', (v_balance + v_balance_bonus), p_amount;
    END IF;

    -- Débiter bonus d'abord
    IF v_balance_bonus >= p_amount THEN
        v_bonus_used := p_amount;
        v_real_used := 0;
    ELSE
        v_bonus_used := v_balance_bonus;
        v_real_used := p_amount - v_balance_bonus;
    END IF;

    -- Mettre à jour les soldes
    UPDATE profiles SET
        balance = balance - v_real_used,
        balance_bonus = balance_bonus - v_bonus_used
    WHERE id = p_user_id;

    -- Créer la transaction
    INSERT INTO transactions (user_id, type, amount, bonus_used, real_used, description, performed_by, booking_id, product_id, parts_count)
    VALUES (p_user_id, p_type, p_amount, v_bonus_used, v_real_used, p_description, p_performed_by, p_booking_id, p_product_id, p_parts_count);

    v_result := json_build_object('bonus_used', v_bonus_used, 'real_used', v_real_used, 'new_balance', v_balance - v_real_used, 'new_balance_bonus', v_balance_bonus - v_bonus_used);
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION : créditer un compte (avec ou sans formule)
-- ============================================
CREATE OR REPLACE FUNCTION credit_user(
    p_user_id UUID,
    p_performed_by UUID,
    p_amount_paid DECIMAL,
    p_amount_credited DECIMAL DEFAULT NULL, -- NULL = crédit libre (pas de bonus)
    p_description TEXT DEFAULT 'Crédit compte'
)
RETURNS VOID AS $$
DECLARE
    v_bonus DECIMAL := 0;
    v_credited DECIMAL;
BEGIN
    v_credited := COALESCE(p_amount_credited, p_amount_paid);
    v_bonus := v_credited - p_amount_paid;

    -- Créditer le solde réel
    UPDATE profiles SET balance = balance + p_amount_paid WHERE id = p_user_id;

    -- Transaction crédit réel
    INSERT INTO transactions (user_id, type, amount, description, performed_by, formula_amount_paid, formula_amount_credited, formula_bonus)
    VALUES (p_user_id, 'credit', p_amount_paid, p_description, p_performed_by,
            CASE WHEN v_bonus > 0 THEN p_amount_paid END,
            CASE WHEN v_bonus > 0 THEN v_credited END,
            CASE WHEN v_bonus > 0 THEN v_bonus END);

    -- Si bonus, créditer le solde bonus + transaction bonus
    IF v_bonus > 0 THEN
        UPDATE profiles SET balance_bonus = balance_bonus + v_bonus WHERE id = p_user_id;
        INSERT INTO transactions (user_id, type, amount, bonus_amount, description, performed_by)
        VALUES (p_user_id, 'credit_bonus', v_bonus, v_bonus, 'Bonus formule (' || p_amount_paid || '€ → ' || v_credited || '€)', p_performed_by);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recharge_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

-- Helper : vérifier si admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES
CREATE POLICY "Profiles: lecture publique limitée" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles: user modifie son profil" ON profiles FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Profiles: admin modifie tout" ON profiles FOR UPDATE USING (is_admin());
CREATE POLICY "Profiles: admin insère" ON profiles FOR INSERT WITH CHECK (is_admin());

-- BOOKINGS
CREATE POLICY "Bookings: lecture auth" ON bookings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Bookings: user crée ses résas" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookings: user annule ses résas" ON bookings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Bookings: admin tout" ON bookings FOR ALL USING (is_admin());

-- BOOKING_PLAYERS
CREATE POLICY "BookingPlayers: lecture auth" ON booking_players FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "BookingPlayers: admin tout" ON booking_players FOR ALL USING (is_admin());

-- TRANSACTIONS
CREATE POLICY "Transactions: user voit les siennes" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Transactions: admin voit tout" ON transactions FOR SELECT USING (is_admin());
CREATE POLICY "Transactions: insert via function" ON transactions FOR INSERT WITH CHECK (true);

-- TOURNAMENTS
CREATE POLICY "Tournaments: lecture publique" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Tournaments: admin CRUD" ON tournaments FOR ALL USING (is_admin());

-- TOURNAMENT_REGISTRATIONS
CREATE POLICY "Registrations: lecture auth" ON tournament_registrations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Registrations: user s'inscrit" ON tournament_registrations FOR INSERT WITH CHECK (auth.uid() = player1_uid);
CREATE POLICY "Registrations: user modifie ses inscriptions" ON tournament_registrations FOR UPDATE
    USING (auth.uid() = player1_uid OR auth.uid() = player2_uid);
CREATE POLICY "Registrations: admin tout" ON tournament_registrations FOR ALL USING (is_admin());

-- EVENTS
CREATE POLICY "Events: lecture publique" ON events FOR SELECT USING (is_public = true);
CREATE POLICY "Events: admin CRUD" ON events FOR ALL USING (is_admin());

-- CLUB_CONFIG, PRICING, FORMULAS
CREATE POLICY "Config: lecture publique" ON club_config FOR SELECT USING (true);
CREATE POLICY "Config: admin modifie" ON club_config FOR UPDATE USING (is_admin());
CREATE POLICY "Pricing: lecture publique" ON pricing_rules FOR SELECT USING (true);
CREATE POLICY "Pricing: admin CRUD" ON pricing_rules FOR ALL USING (is_admin());
CREATE POLICY "Formulas: lecture publique" ON recharge_formulas FOR SELECT USING (true);
CREATE POLICY "Formulas: admin CRUD" ON recharge_formulas FOR ALL USING (is_admin());

-- PRODUCTS
CREATE POLICY "Categories: lecture publique" ON product_categories FOR SELECT USING (true);
CREATE POLICY "Categories: admin CRUD" ON product_categories FOR ALL USING (is_admin());
CREATE POLICY "Products: lecture publique" ON products FOR SELECT USING (true);
CREATE POLICY "Products: admin CRUD" ON products FOR ALL USING (is_admin());

-- FRIENDSHIPS
CREATE POLICY "Friends: user voit les siens" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Friends: user gère les siens" ON friendships FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- DONNÉES INITIALES
-- ============================================
INSERT INTO club_config (name) VALUES ('Padel Camp Achères');

INSERT INTO recharge_formulas (amount_paid, amount_credited) VALUES
    (100, 113), (200, 228), (300, 351), (400, 468);

INSERT INTO pricing_rules (label, start_time, end_time, days, price_per_slot) VALUES
    ('Heure creuse', '09:30', '12:00', ARRAY[0,1,2,3,4], 24),
    ('Heure pleine', '12:00', '18:00', ARRAY[0,1,2,3,4], 36),
    ('Premium', '18:00', '23:00', ARRAY[0,1,2,3,4], 42),
    ('Week-end', '09:30', '23:00', ARRAY[5,6], 42);
