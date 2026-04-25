# CLAUDE.md — Padel Camp Achères

## Projet
Application de gestion et réservation pour le club **Padel Camp Achères**.
- **Stack** : React 19 (Vite) + Tailwind CSS + Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **Design** : Mobile-first, style Apple, font Poppins, charte couleurs bleu marine #0B2778 + lime #D4E620
- **PWA** : Progressive Web App (manifest + service worker)
- **Hosting** : Vercel — https://padel-camp-iota.vercel.app
- **Repo** : https://github.com/RemiRqt/padel-camp

## Informations du club
- Nom : Padel Camp Achères
- Adresse : 10 Rue des Communes, 78260 Achères
- Téléphone : 01 34 01 58 48
- Horaires : 9h30-23h, tous les jours (lundi au dimanche)
- Terrains : 3 terrains intérieurs
- Instagram : https://www.instagram.com/padel_campacheres/

## Supabase Config
Fichier `.env` à la racine :
```
VITE_SUPABASE_URL=https://volranoojbqeramwldaf.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_SW_i7F1Lw1vW2an6ABwKcQ_BjLybFCO
```
Client initialisé dans `src/lib/supabase.js` via `createClient(url, anonKey)`.

## Architecture des dossiers
```
src/
├── components/
│   ├── ui/          # Button, Input, Modal, Toast, Card, Badge
│   ├── booking/     # BookingCalendar, SlotPicker, SlotCard
│   ├── admin/       # AdminDashboard, MemberList, ClubSettings, POS, ProductCatalog
│   ├── tournament/  # TournamentList, TournamentDetail, RegisterForm, MyTournaments
│   └── layout/      # AppLayout, BottomNav, Header, PageWrapper, AdminLayout
├── pages/
│   ├── public/      # Landing, Login, Register, Tournaments, Events
│   ├── user/        # Dashboard, Booking, BookingConfirm, Profile, MyTournaments
│   └── admin/       # AdminDash, Revenue, Bookings, Courts, Members, Tournaments, POS, Products, Formulas, Settings
├── hooks/           # useAuth, useBookings, useClub, useAdmin, useTournaments
├── lib/
│   ├── supabase.js  # Client Supabase
│   └── permissions.js # Système de permissions centralisé
├── services/        # authService, bookingService, userService, tournamentService, productService
├── context/         # AuthContext, ClubContext
└── utils/           # formatDate, calculatePrice, validators, export
```

## Routes
| Route | Accès | Description |
|-------|-------|-------------|
| `/` | Public | Landing page : infos club, tarifs, dispos, tournois, événements |
| `/login` | Public | Connexion email/password |
| `/register` | Public | Inscription nouveau membre |
| `/dashboard` | User | Tableau de bord (prochaines résas, solde avec détail bonus, prochain tournoi) |
| `/booking` | User | Calendrier réservation interactif (3 terrains, créneaux configurables) |
| `/booking/:id` | User | Confirmation résa + invitation joueurs |
| `/profile` | User | Modifier infos + numéro licence FFT |
| `/friends` | User (v2) | Liste d'amis |
| `/tournaments` | Public | Liste tournois à venir |
| `/tournaments/:id` | User | Détail tournoi + formulaire inscription paire |
| `/tournaments/:id/register` | User | Inscription paire (membre ou externe) |
| `/my-tournaments` | User | Mes inscriptions + confirmations 48h |
| `/events` | Public | Événements ponctuels (informatif) |
| `/admin` | Admin | Dashboard admin (KPIs) |
| `/admin/calendar` | Admin | Gérer toutes les réservations |
| `/admin/members` | Admin | Membres : liste, créditer, créer |
| `/admin/settings` | Admin | Config club |
| `/admin/tournaments` | Admin | Gérer tournois + inscriptions |
| `/admin/products` | Admin | Catalogue articles par catégories |
| `/admin/pos` | Admin | Point de vente |
| `/admin/formulas` | Admin | Configurer formules de recharge |
| `/admin/financial-export` | Admin | Rapport financier avec aperçu + export Excel/PDF |

## Schéma SQL
Voir `supabase/migrations/` pour les tables, enums, triggers, fonctions SQL, RLS et données initiales.

**Tables principales** : `profiles`, `bookings`, `booking_players`, `transactions`, `tournaments`, `tournament_registrations`, `events`, `products`, `product_categories`, `pricing_rules`, `recharge_formulas`, `club_config`, `friendships`

**Fonctions SQL critiques** :
- `debit_user()` — débit bonus-first, enregistre `bonus_used` + `real_used`
- `credit_user()` — crédit avec formules (solde réel + bonus séparé)
- `is_admin()` — helper RLS

**Migrations** :
- `001_initial_schema.sql` : tables, enums, index, triggers, fonctions, RLS, données initiales
- `002_payment_status.sql` : champs payment_status sur bookings + booking_players, trigger auto
- `003_social.sql` : tables friends + matches + RLS
- `004_seed_data.sql` : 10 membres test, ~670 résas mars, transactions, tournois, événements, produits
- `005_invitation_status.sql` : invitation_status sur booking_players
- `006_fix_payment_status_trigger.sql` : fix trigger payment status
- `007_reset_payment_status.sql` : reset payment status

## Logique de débit (CRITIQUE)
Lors de tout débit (session ou article), utiliser la fonction SQL `debit_user()` qui :
1. Débite sur `balance_bonus` en priorité (bonus first)
2. Le reste sur `balance` (solde réel)
3. Enregistre `bonus_used` + `real_used` dans la transaction

L'utilisateur voit un solde global unique (balance + balance_bonus). La ventilation est transparente pour lui mais visible par l'admin.

## Répartition session par parts
- Répartition **égale par défaut** (prix ÷ nombre de joueurs)
- L'admin peut **ajuster** les parts
- Non-membre → transaction `external_payment` (CB/espèces)
- Exemple : créneau 42€, 4 joueurs → 3 membres à 10,50€ + 1 externe CB 10,50€

## Workflow inscription tournoi
1. Joueur 1 (avec licence) s'inscrit et désigne un partenaire
2. Partenaire membre → recherche dans le club (vérification licence)
3. Partenaire externe → saisie manuelle nom + licence FFT
4. Si partenaire membre : statut → `pending_partner`
5. Joueur 2 accepte → `pending_admin`
6. Admin valide chronologiquement → `approved` (ou `waitlist` si complet)
7. 48h avant → notification confirmation
8. Les 2 confirment → `confirmed`
9. Non-confirmation → annulation + premier waitlist promu

## Annulation réservation
- User : annulation **jusqu'à 24h avant** → remboursement auto
- Moins de 24h → seul admin peut annuler avec remboursement manuel

## Design System
- **Font** : Poppins (300, 400, 500, 600, 700)
- **Couleurs** : Primary `#0B2778`, Lime `#D4E620`, Success `#34C759`, Danger `#FF3B30`, Warning `#FF9500`, BG `#F2F2F7`, Text `#1C1C1E` / `#6E6E73` / `#AEAEB2`
- **Border radius** : Cards `16px`, Buttons `14px` (pills `9999px`), Inputs `12px`
- **Ombres** : Cards `0 1px 3px rgba(0,0,0,0.04)`, Elevated `0 4px 12px rgba(11,39,120,0.15)`
- **Mobile** : Bottom nav 5 items (Accueil, Réserver, Social, Tournois, Compte)
- **Desktop (≥1024px)** : Sidebar gauche
- **Glass effect** : `backdrop-filter: blur(40px)` pour bottom nav

## État actuel — Mis à jour le 27/03/2026

### Pages implémentées (25 pages)
**Publiques** : Landing (/), Login, Register, AuthCallback, 404
**User** : Dashboard (solde, invitations, confirmations 48h, résas, tournoi, transactions), Booking (grille 3 terrains), BookingConfirm (4 joueurs, paiement indépendant, invitations), Profile, Tournaments (badges inscription), TournamentDetail, TournamentRegister, MyTournaments, Social (amis + matchs), Events
**Admin** : Dashboard (8 KPIs + recharts), Calendar, Members, Formulas, Tournaments (liste + vue détail inscriptions/waitlist), Products, POS (onglets sessions/articles, grille terrains), Settings

### Améliorations récentes (27/03/2026)
- **Code-splitting** : lazy-load toutes les pages (bundle 274 KB)
- **PWA** : manifest.json, service worker auto-versionné, bandeau hors ligne
- **ConfirmModal** : remplace tous les confirm() natifs
- **ErrorBoundary** global + ErrorState sur Dashboard et Booking
- **Export lazy** : xlsx/jspdf chargés au clic
- **Annulation 24h** : vérification côté service
- **Rollbacks** : createBooking() et acceptInvitation() annulent en cas d'échec partiel

### Système de paiement
- Prix session ÷ 4 joueurs (padel = 4 joueurs toujours)
- Paiement indépendant par joueur (solde/CB/espèces)
- Trigger SQL `update_booking_payment_status` auto-met à jour `payment_status` (pending → partial → paid)
- Rollback automatique si débit échoue après création résa/acceptation invitation

### Déploiement
- `git push` → Vercel auto-deploy
- Variables env dans Vercel : VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- Supabase Auth redirect URL : https://padel-camp-iota.vercel.app/auth/callback

## Prochain travail — Page Admin Rapport Financier

### Route : `/admin/financial-export`

### Description
Page admin avec **aperçu visuel AVANT export** des données financières sur une période donnée.

### Layout
1. **En-tête** : titre + date pickers (début/fin) + bouton Actualiser
2. **4 cartes KPI** (grid 2x2) : Sessions, Articles, Rechargements, Total encaissements — chacun avec ventilation wallet/CB/espèces
3. **Carte Soldes Wallets** : soldes réel+bonus début → fin de période, avec variation
4. **Onglets transactions** : Wallet / CB / Espèces
5. **Tableau détail** : Date, Membre, Type, Montant — trié par date desc, avec sous-totaux par type
6. **Boutons export** : Excel / PDF / Imprimer

### Implémentation
- Fetch toutes les transactions sur la période via `supabase.from('transactions')`
- Calcul des KPI côté client (groupBy payment_method + type)
- Export Excel : classeur multi-feuilles (Résumé, Wallet, CB, Espèces)
- Export PDF : jsPDF + autoTable (déjà lazy-loadé)
- Export lazy : pattern existant dans `src/utils/export.js`

### Fichiers à créer/modifier
- `src/pages/admin/AdminFinancialExport.jsx` — nouvelle page
- `src/App.jsx` — ajouter route lazy `/admin/financial-export`
- `src/components/layout/Sidebar.jsx` + `Header.jsx` — ajouter lien nav admin

## Règles de développement

### Principes fondamentaux
1. **Simplicité** — un fichier doit être compris en < 30 secondes
2. **Séparation des responsabilités** — composant → service → base de données
3. **Performance par défaut** — chargement initial < 1s, navigation < 200ms
4. **Scalabilité** — pagination, limites, index, cache dès le départ

### Architecture obligatoire
- **Jamais** d'accès Supabase dans les pages ou composants — toujours via un service
- **Jamais** de vérification de rôle en dur (`role === 'admin'`) — utiliser `canAccess()` de `lib/permissions.js`
- **Jamais** de `select('*')` — lister les colonnes nécessaires
- **Toujours** `.limit()` sur toutes les requêtes
- **Toujours** `Promise.all()` pour regrouper les requêtes d'une même vue

### Limites de taille des fichiers
| Élément | Maximum |
|---------|---------|
| Fichier | 300 lignes |
| Fonction | 30 lignes |
| Composant React | 200 lignes |

Si dépassé → découper en sous-composants ou modules.

### Performance frontend
- **Code-splitting** : `React.lazy()` pour toutes les pages (déjà en place)
- **Lazy imports** : bibliothèques lourdes (recharts, xlsx, jspdf) chargées au clic
- **Skeleton loaders** obligatoires sur chaque page avec chargement async
- **Pas de blank screen** : toujours un fallback visible

### Gestion d'erreurs
Toute opération asynchrone : try/catch + toast.success/error.

### Anti-patterns interdits
- ❌ Requêtes DB dans les composants UI ou pages
- ❌ `select('*')` sans lister les colonnes
- ❌ Multiple appels API séquentiels pour une seule vue
- ❌ Fichiers > 300 lignes
- ❌ Vérifications de rôle en dur
- ❌ Bibliothèques lourdes chargées au démarrage
- ❌ Absence de gestion d'erreurs sur les appels async
- ❌ Listes sans pagination

### Checklist avant livraison
- [ ] Architecture service layer respectée (pas de supabase dans les pages)
- [ ] Permissions via `lib/permissions.js`
- [ ] Requêtes optimisées (colonnes explicites, limit, pagination)
- [ ] Erreurs gérées (try/catch + toast)
- [ ] UI charge instantanément (skeleton/loading)
- [ ] Fichier < 300 lignes

### Workflow de développement
```
1. Architecture (service + types nécessaires)
2. Service layer (fonctions DB)
3. Optimisation requêtes (select, limit, index)
4. UI (composant React)
5. Gestion d'erreurs (try/catch + feedback)
6. Tests manuels
```
Ne jamais commencer par l'UI.

### Conventions de code
- Composants React : PascalCase, fichiers .jsx
- Hooks customs : useNomDuHook.js / Services : nomService.js
- Tailwind pour tout le style — pas de TypeScript pour le MVP
- Imports absolus via alias `@/` → `src/`
- Toast : react-hot-toast / Icônes : lucide-react / Graphiques : recharts (lazy)
- Supabase client : import depuis `@/lib/supabase.js`
- Realtime : `supabase.channel()` pour les mises à jour en temps réel des créneaux
