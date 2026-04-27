# Spec — Démo mercredi 29/04 + cadre de dev

**Date :** 2026-04-27
**Échéance critique :** mercredi 29/04 matin (présentation au club)
**Auteur :** Rémi + Claude

---

## 1. Contexte & objectifs

L'application Padel Camp Achères doit être présentée mercredi matin au club. La démo doit montrer toutes les fonctionnalités avec des données fictives cohérentes (membres, réservations, règlements, rapport financier).

Après la démo, l'application reste en évolution : il faut un cadre de développement propre pour pouvoir modifier le code sans casser la démo, et préparer le terrain pour le lancement live aux vrais membres du club.

**Objectifs :**
1. Garantir une démo fonctionnelle et crédible mercredi matin.
2. Mettre en place un workflow de dev contrôlé (branches, PR, tests, doc) après la démo.
3. Lister les chantiers déférés (audit sécurité, live) sans les démarrer maintenant.

**Non-objectifs (hors scope) :**
- Audit sécurité exhaustif (déféré, lancé sur signal explicite).
- Création de l'environnement live (différée jusqu'à validation par le club).
- CI/CD avancé, tests automatisés, monitoring.

---

## 2. Architecture des environnements

### 2.1 État avant mercredi (phase 1)

| Élément | Valeur |
|---|---|
| Branche git | `master` (existante, pas de renommage) |
| Projet Vercel | `padel-camp-iota` (existant) |
| URL | `padel-camp-iota.vercel.app` |
| Projet Supabase | `volranoojbqeramwldaf` (existant) |

Un seul environnement, pas d'isolation entre démo et dev. Tous les pushs sur `master` vont en production. Règle d'or : **plus aucun push entre mardi soir et la fin de la présentation**.

### 2.2 État après mercredi (phase 2)

| Branche | Rôle | Vercel | Supabase |
|---|---|---|---|
| `master` | Démo figée | Production deploy | `volranoojbqeramwldaf` (partagé) |
| `dev` | Travail en cours | Preview deploy (URL auto-générée par push) | `volranoojbqeramwldaf` (partagé) |

**Isolation :**
- **Code** : `master` protégée (PR + review obligatoires). `dev` accessible librement, ses déploiements sont des previews Vercel (URL distincte du domaine principal).
- **Données** : aucune. Le même Supabase est partagé. **Risque accepté** : une migration appliquée pour le dev affecte aussi la démo. Mitigation : checklist PR obligatoire, migrations testées localement, et la démo n'est plus régulièrement présentée après mercredi.

### 2.3 État futur (phase 3, hors scope ici)

Création d'un environnement `live` séparé : nouveau Supabase vide, nouvelle branche `live`, nouveau projet Vercel, domaine custom. Déclenché sur signal explicite après validation du club et après audit sécurité complet.

---

## 3. Phase 1 — Travaux avant mercredi matin

### 3.1 Polish des données fictives

**Cible :** un script SQL idempotent ou un script Node lancé contre le Supabase actuel, qui ajoute par-dessus l'existant sans casser ce qui est déjà là.

**Contenu :**

#### 3.1.1 Membres fictifs
- 30 membres ajoutés (en plus de l'existant)
- Emails : `prenom.nom@demo.padelcamp.test` (domaine factice non résolvable)
- Téléphones : préfixe `+33 6 99 99 XX XX` (hors plages réelles)
- Licences FFT : numéros à 7 chiffres factices (`90XXXXX`)
- Profils variés : ~20 membres actifs, ~5 inscrits récents, ~3 admins/staff, ~2 inactifs

#### 3.1.2 Réservations
- **Avril** : remplissage à ~70% du planning (3 terrains × créneaux configurés dans `club_config`)
- **Mai** : remplissage dégressif
  - Semaine 1 : 60%
  - Semaine 2 : 45%
  - Semaine 3 : 30%
  - Semaine 4 : 15%
- 4 joueurs par réservation (padel = 4 joueurs)
- Joueurs piochés aléatoirement parmi les 30 membres + invités externes occasionnels (~10% des places)

#### 3.1.3 Règlements (sessions passées uniquement)
Pour chaque session **antérieure à la date du jour** (27/04) :
- Chaque joueur paie sa part (prix session ÷ 4)
- Mix réaliste des modes :
  - ~70% wallet (via SQL `debit_user()` — bonus first puis solde réel)
  - ~20% CB (via RPC `external_payment` — `payment_method='card'`)
  - ~10% espèces (via RPC `external_payment` — `payment_method='cash'`)
- Sessions futures : statut naturel (`pending`/`partial`)

#### 3.1.4 Rechargements wallet
- ~15-20 membres ont 1-3 recharges sur la période
- Utilisation des `recharge_formulas` existantes (montants déjà en base, ex : 50€ → 55€)
- Mix wallet/CB/espèces sur les recharges aussi (~50% CB, ~40% espèces, ~10% virement)

#### 3.1.5 Articles vendus (POS)
- 2-5 ventes par jour sur la période
- S'appuie sur les `products` existants
- **TVA variées** : si le catalogue actuel n'a pas de variété, on ajuste les TVA des produits pour qu'apparaissent dans le rapport financier des lignes 5,5% (alimentaire), 10%, 20% (matériel)

### 3.2 Light security pass

Pas d'audit complet. Vérifications rapides uniquement :
- ✅ Aucune clé Supabase `service_role` en clair dans le repo (grep)
- ✅ `.env`, `.env.local`, `.env.*` bien dans `.gitignore`
- ✅ RLS activée sur toutes les tables (vérification via Supabase dashboard)
- ✅ Aucun secret hardcodé visible (search)

Tout problème détecté = corrigé immédiatement. Tout problème non-trivial = noté, traité dans l'audit complet post-mercredi.

### 3.3 Bugs

Aucune liste prédéfinie. Traités au fil de l'eau si Rémi en signale.

### 3.4 Mercredi matin

- Plus aucun push depuis mardi soir
- Démo lancée sur `padel-camp-iota.vercel.app`
- Compte admin de démo prêt

---

## 4. Phase 2 — Après mercredi : split + cadre de dev

### 4.1 Création de la branche `dev`

```bash
git checkout master && git pull
git tag demo-2026-04-29   # snapshot du commit présenté
git push origin demo-2026-04-29
git checkout -b dev
git push -u origin dev
```

À partir de là, tout commit passe par `dev`. Les pushs sur `master` se font uniquement via PR mergée.

### 4.2 Protection de `master` sur GitHub

- Require PR before merging
- Require approvals : 1
- Dismiss stale reviews on new commits
- Require linear history (optionnel, plus propre)

### 4.3 Cadre de dev (option D — combo `CLAUDE.md` + PR template + hooks)

#### 4.3.1 Mise à jour de `CLAUDE.md`
Ajout d'une section **Branches & déploiement** :

```
## Branches & déploiement

- `master` (= démo) : protégée, PR + review obligatoires. Production Vercel.
- `dev` : branche de travail. Preview deploys Vercel.
- `live` (futur) : séparation complète, créée quand le client valide.

## Avant tout merge dans master

- [ ] Migration SQL ? Si oui, testée localement (`supabase db push --local`)
- [ ] RLS vérifiée sur les tables touchées
- [ ] Pas de `select('*')`, `.limit()` partout
- [ ] Erreurs gérées (try/catch + toast)
- [ ] Plan de test manuel exécuté (user ET admin si la feature concerne les deux rôles)
- [ ] Aucune clé secrète committée
```

#### 4.3.2 PR template GitHub
Fichier : `.github/pull_request_template.md`

```markdown
## Objectif
<courte description>

## Plan de test exécuté
- [ ] En tant que user (parcours golden) : ...
- [ ] En tant qu'admin (si applicable) : ...
- [ ] Cas limites testés : ...

## Checklist
- [ ] Migration SQL ? Si oui, testée
- [ ] RLS vérifiée
- [ ] Requêtes optimisées (colonnes explicites, .limit())
- [ ] Erreurs gérées
- [ ] Aucun secret committé
- [ ] CLAUDE.md mis à jour si la doc le nécessite
```

#### 4.3.3 Plan de test manuel — template
Fichier : `docs/test-plans/TEMPLATE.md`

```markdown
# Plan de test — <feature>

## Rôle(s) testé(s)
- [ ] User
- [ ] Admin

## Parcours golden
1. ...

## Cas limites
1. ...

## Captures d'écran (optionnel)
```

#### 4.3.4 Hooks Claude Code
Fichier : `.claude/settings.json` (ou `settings.local.json`)

Deux hooks discrets :
- `PostToolUse` filtré sur `Edit`/`Write` matchant `src/pages/admin/**` ou `src/pages/**.jsx` → message rappel : *"Pense à exécuter ton plan de test manuel sur l'env dev avant merge."*
- `PreToolUse` filtré sur `Bash` matchant `git commit|git push origin master` → message rappel : *"PR template rempli ? Migration testée ?"*

### 4.4 Premier travail sur `dev` après le cadre

Aucune liste prédéfinie ici. Rémi décide ce qu'il veut attaquer en premier après mercredi.

---

## 5. Phase 3 — Hors scope (déféré)

Liste à titre de mémoire, **non implémentée par cette spec** :

- 🔒 **Audit sécurité complet** : RLS de toutes les tables, services, gestion auth, tokens, validations input, exports, hooks Edge Functions. Lancé sur signal explicite après mercredi.
- 🚀 **Environnement live** : nouveau Supabase vide, nouvelle branche `live`, nouveau projet Vercel, domaine custom (à définir avec le club). Lancé sur signal explicite.
- 🌐 **Domaine custom** : DNS + SSL pour le live.
- 🔁 **CI/CD** : GitHub Actions pour les tests et linting automatiques.
- 🧪 **Tests automatisés** : unitaires + e2e.

---

## 6. Annexes

### 6.1 Paramètres du seed de démo

| Paramètre | Valeur |
|---|---|
| Nombre de membres ajoutés | 30 |
| Domaine email | `@demo.padelcamp.test` |
| Préfixe téléphone | `+33 6 99 99` |
| Préfixe licence FFT | `90` (7 chiffres) |
| Période de réservations | 01/04/2026 → 31/05/2026 |
| Taux d'occupation avril | 70% |
| Taux d'occupation mai (S1→S4) | 60% / 45% / 30% / 15% |
| Mix règlements sessions | 70% wallet / 20% CB / 10% espèces |
| Mix règlements recharges | 50% CB / 40% espèces / 10% virement |
| Articles vendus / jour | 2-5 |
| TVA articles | 5.5% / 10% / 20% (à diversifier dans le catalogue) |

### 6.2 Risques identifiés et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Push après mardi soir casse la démo | Moyenne | Critique | Règle d'or no-push + tag git de sauvegarde |
| Migration en dev casse la démo (Supabase partagé) | Moyenne | Élevé | Checklist PR + migrations testées localement avant push |
| Données fictives identifiées comme données réelles par le club | Faible | Moyen | Domaines email `.test` non-résolvables + mention "données de démonstration" en pied de page admin (si simple) |
| Audit sécurité tarde et live ouvert prématurément | Faible | Critique | Live conditionné explicitement à l'audit dans cette spec |

### 6.3 Ordre d'exécution recommandé (phase 1)

1. **Aujourd'hui (lundi)** : light security pass + script de seed des membres et résas
2. **Mardi** : règlements + recharges + articles + tests visuels du rapport financier
3. **Mardi soir** : freeze (no-push), revue finale de la démo
4. **Mercredi matin** : présentation
5. **Mercredi après-midi / jeudi** : phase 2 (split + cadre de dev)
