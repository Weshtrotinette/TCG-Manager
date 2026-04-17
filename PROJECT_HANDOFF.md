# TCG Association Manager - Documentation technique complete

## Vue d'ensemble
Application web interne de gestion d'une association de tournois TCG (Trading Card Game) pour ~150 joueurs. L'app centralise la gestion des membres, cotisations, evenements, tournois, ventes (caisse rapide/POS), merchandising, depenses et rapports financiers.

**Stack technique** : React 19 (frontend) + FastAPI (backend) + MongoDB (base de donnees)

---

## Architecture

```
/backend/
  server.py           # Fichier unique FastAPI (~3400 lignes). Contient tous les modeles, routes et logique metier
  requirements.txt     # Dependances Python
  uploads/products/    # Stockage images produits
  .env                 # Variables d'environnement

/frontend/
  src/
    App.js                        # Routing principal
    index.js                      # Point d'entree
    index.css / App.css           # Styles globaux + design system
    contexts/
      AuthContext.jsx             # Gestion auth (sessions, permissions, roles)
      ThemeContext.jsx             # Dark/Light mode
    lib/
      api.js                      # Client HTTP - toutes les methodes API
      utils.js                    # Helpers (formatDate, formatCurrency, labels)
    components/
      auth/AuthCallback.jsx       # Callback Google OAuth
      auth/ProtectedRoute.jsx     # Guard de route authentifiee
      layout/MainLayout.jsx       # Layout principal avec sidebar
      layout/Sidebar.jsx          # Navigation laterale retractable
      ui/                         # Composants Shadcn UI (40+ composants)
    pages/
      LoginPage.jsx               # Page de connexion (Google OAuth + email/password)
      DashboardPage.jsx           # Tableau de bord financier
      MembersPage.jsx             # CRUD membres + colonnes Pack Tournois / Carte Snack
      SubscriptionsPage.jsx       # Cotisations avec Pack Tournois + Carte Snack en option
      EventsPage.jsx              # Liste des evenements
      EventDetailPage.jsx         # Detail evenement + participants + Pack Tournois
      TournamentPage.jsx          # Gestion tournois (Swiss, Round Robin, Elimination)
      POSPage.jsx                 # Caisse rapide tablette + Carte Snack
      ProductsPage.jsx            # CRUD produits avec upload image
      SalesPage.jsx               # Historique ventes + annulations
      ExpensesPage.jsx            # CRUD depenses
      ReportsPage.jsx             # Rapports financiers + exports PDF/CSV
      SettingsPage.jsx            # Parametres (6 onglets) + reinitialisation
      UsersPage.jsx               # Gestion utilisateurs
      RolesPage.jsx               # Gestion roles
      WhitelistPage.jsx           # Whitelist emails autorises
  public/
    manifest.json                 # PWA manifest
    sw.js                         # Service Worker (offline)
    icon-192.svg / icon-512.svg   # Icones PWA
```

---

## Variables d'environnement

### Backend (.env)
```
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/tcg_manager
DB_NAME=tcg_manager
JWT_SECRET=un_secret_aleatoire
CORS_ORIGINS=https://ton-frontend.com  (optionnel, defaut: *)
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://ton-backend.com
```

**IMPORTANT** : Le frontend prefixe toutes les requetes avec `/api`. Le backend a un router prefixe `/api`. En production, le frontend appelle `REACT_APP_BACKEND_URL/api/...`.

---

## Base de donnees MongoDB

### Collections et schemas

**members**
```
member_id, first_name, last_name, pseudo, email, phone,
first_participation_date, membership_date, status, notes,
participation_count, member_type, has_pack_tournois,
created_at, updated_at
```
- `member_type`: "adherent" ou "non_adherent"
- `status`: "nouveau", "essai", "actif", "non_a_jour", "archive"
- `has_pack_tournois`: boolean (1 seul pack par membre)

**subscriptions** (cotisations)
```
subscription_id, member_id, season, amount_due, amount_paid,
status, includes_pack_tournois, includes_carte_snack,
payments: [{payment_id, date, amount, payment_method, comment}],
created_at
```
- `status`: "non_payee", "partielle", "payee"
- Pack et carte sont attribues UNIQUEMENT quand status passe a "payee"

**snack_cards** (cartes snack)
```
card_id, member_id, balance, initial_value, season, created_at
```
- Un membre peut avoir plusieurs cartes
- Utilisables en caisse rapide (POSPage)
- Deduction partielle possible (le reste paye par autre moyen)

**events**
```
event_id, name, event_type, format, date, location,
entry_fee, max_participants, is_free, description,
created_at
```
- `event_type`: tournoi, ligue, session_libre, demonstration, atelier
- `format`: suisse, elimination_simple, round_robin, etc.

**participations**
```
participation_id, event_id, member_id, is_present, entry_paid,
payment_method, used_pack_tournois, registered_at
```

**tournaments**
```
tournament_id, event_id, format, total_rounds, current_round,
status, participants: [member_ids], matches: [{...}],
standings: [{...}], created_at
```
- Algorithmes: Swiss (Buchholz), Round Robin (methode du cercle), Elimination simple
- `status`: "pending", "in_progress", "completed"

**products**
```
product_id, name, category, subcategory, description, image_url,
price, cost, track_stock, stock_quantity, low_stock_threshold,
is_active, created_at
```

**sales** (ventes POS)
```
sale_id, items: [{product_id, name, quantity, unit_price}],
total_amount, payment_method, payment_status, event_id,
created_by, comment, created_at
```

**expenses** (depenses)
```
expense_id, description, amount, category, payment_method,
date, receipt_ref, created_by, created_at
```

**settings**
```
settings_id: "main_settings"
annual_subscription_amount, max_free_participations,
enable_trial_rule, enable_trial_alerts, current_season,
season_renewal_day, season_renewal_month,
pack_tournois_price, carte_snack_price, carte_snack_value,
cards_are_permanent,
payment_methods: [], member_statuses: [], expense_categories: [],
product_categories: {cat: [subcats]}, pos_visible_subcategories: [],
event_types: [], event_formats: []
```

**users, user_sessions, roles, permissions, whitelist, audit_logs, subscription_archives, stock_movements**

---

## API Endpoints (tous prefixes /api)

### Auth
- `POST /api/auth/session` - Callback Google OAuth (Emergent)
- `POST /api/auth/register` - Inscription email/password
- `POST /api/auth/login/email` - Connexion email/password
- `GET /api/auth/me` - User courant + permissions
- `POST /api/auth/logout`

### Membres
- `GET /api/members` - Liste (enrichie avec snack_card_balance, has_pack_tournois)
- `POST /api/members` - Creer
- `PUT /api/members/{id}` - Modifier
- `DELETE /api/members/{id}` - Archiver
- `PUT /api/members/{id}/unarchive`
- `POST /api/members/refresh-statuses` - Recalcul auto des statuts

### Cotisations
- `GET /api/subscriptions` - Liste saison courante
- `POST /api/subscriptions` - Creer (avec includes_pack_tournois, includes_carte_snack)
- `PUT /api/subscriptions/{id}` - Modifier
- `DELETE /api/subscriptions/{id}`
- `POST /api/subscriptions/{id}/payments` - Ajouter un paiement
- `POST /api/subscriptions/new-season` - Nouvelle saison (archive + reset)
- `GET /api/subscriptions/archives` - Saisons archivees
- `GET /api/subscriptions/archives/{season}`

### Evenements & Participations
- `GET/POST /api/events`
- `GET/PUT/DELETE /api/events/{id}`
- `POST /api/participations`
- `PUT /api/participations/{id}` (supporte `use_pack_tournois`)
- `DELETE /api/participations/{id}`

### Tournois
- `GET /api/tournaments/event/{event_id}`
- `POST /api/tournaments` - Creer un tournoi
- `PUT /api/tournaments/{id}/match/{match_id}` - Enregistrer resultat
- `POST /api/tournaments/{id}/next-round` - Generer la ronde suivante
- `DELETE /api/tournaments/{id}`

### Produits & POS
- `GET/POST /api/products`
- `GET/PUT/DELETE /api/products/{id}`
- `POST /api/products/{id}/restock`
- `POST /api/products/{id}/upload-image` (multipart form)
- `DELETE /api/products/{id}/image`
- `GET/POST /api/sales`
- `PUT /api/sales/{id}/cancel`

### Cartes Snack & Pack Tournois
- `GET /api/snack-cards` - Liste cartes actives (avec noms membres)
- `POST /api/snack-cards?member_id=xxx` - Creer carte directe (achat en caisse)
- `POST /api/snack-cards/{id}/deduct?amount=x` - Deduire montant
- `GET /api/members/{id}/pack-tournois` - Verifier si pack dispo
- `POST /api/members/{id}/use-pack-tournois` - Consommer le pack
- `DELETE /api/members/{id}/pack-tournois` - Retirer pack (correction admin)
- `DELETE /api/members/{id}/snack-cards` - Retirer cartes (correction admin)

### Depenses & Finance
- `GET/POST /api/expenses`
- `PUT/DELETE /api/expenses/{id}`
- `GET /api/dashboard` - Stats financieres
- `GET /api/reports/financial` - Rapport financier detaille
- `GET /api/reports/members` - Rapport membres

### Parametres & Admin
- `GET/PUT /api/settings`
- `POST /api/admin/reset-financial-data` - Reinitialise ventes, depenses, cotisations, cartes (president only)
- `GET /api/audit-logs`
- `GET/POST/DELETE /api/whitelist`
- `POST /api/whitelist/bulk`
- `GET/POST/PUT/DELETE /api/roles`
- `GET /api/permissions`

---

## Logique metier importante

### Statuts membres automatiques
- **nouveau** : vient de s'inscrire, 0 participation
- **essai** : entre 1 et `max_free_participations` participations, pas encore cotise
- **non_a_jour** : depasse le seuil de participations gratuites OU cotisation non payee
- **actif** : cotisation payee pour la saison en cours
- Recalcul via `POST /api/members/refresh-statuses`

### Pack Tournois
- Prix configurable (defaut 5EUR)
- 1 seul par membre a la fois
- Optionnel lors de la cotisation (checkbox)
- Attribue uniquement quand la cotisation est entierement payee
- Utilisable lors du paiement d'inscription a un evenement (checkbox dans EventDetailPage)
- Si utilise, la somme n'est PAS comptee en recette evenement
- Si `cards_are_permanent` est false, supprime a chaque nouvelle saison

### Carte Snack
- Prix d'achat configurable (defaut 10EUR), valeur reelle configurable (defaut 12EUR)
- Un membre peut avoir plusieurs cartes
- Creee quand cotisation payee OU achetee en caisse rapide
- En caisse: dropdown avec noms membres + solde restant
- Deduction partielle: si le total depasse le solde, le reste est paye normalement
- Si `cards_are_permanent` est false, supprimees a chaque nouvelle saison
- Achat en caisse: apres paiement d'un produit "carte snack", popup d'attribution a un membre

### Tournois - Algorithmes
- **Suisse** : appariement par score decroissant, evite les doublons, BYE si impair, classement Buchholz
- **Round Robin** : methode du cercle, chaque joueur affronte tous les autres
- **Elimination simple** : bracket, BYE si nombre non puissance de 2

### Caisse rapide (POS)
- Produits groupes par sous-categorie (configurable)
- Whitelist de sous-categories visibles en caisse (dans Parametres > Caisse)
- Modes de paiement dynamiques (depuis Parametres > Paiements)
- Photos produits dans les boutons
- Deduction carte snack avant paiement classique

### Nouvelle saison
- Declenchee manuellement via bouton (pas automatique)
- Archive toutes les cotisations courantes
- Reset tous les adherents en "non_a_jour"
- Si cartes non permanentes: supprime pack_tournois et snack_cards
- Date de renouvellement configurable (jour/mois) dans Parametres

---

## Authentification

### Double authentification
1. **Google OAuth via Emergent** : Le frontend redirige vers `https://demobackend.emergentagent.com/auth/v1/env/oauth/...`. Le callback valide le token via l'API Emergent et cree une session.
2. **Email/password** : Inscription + connexion avec bcrypt. JWT dans cookie `session_token`.

### Systeme de whitelist
- Seuls les emails dans la whitelist peuvent se connecter
- Gerable depuis la page Whitelist (ajout individuel ou en masse)

### Roles et permissions
- **president** : acces complet (permission "*")
- **tresorier** : finance, cotisations, depenses, produits, rapports
- **organisateur** : evenements, participations, membres, ventes
- **lecture_seule** : consultation uniquement
- Permissions granulaires par module:action (ex: "members:create", "sales:cancel")
- Le premier utilisateur devra etre mis en role "president" manuellement dans la DB ou via un seed

---

## Design & UI
- **Design system** : Swiss-inspired, dark/light mode
- **Composants** : Shadcn UI (40+ composants dans `/components/ui/`)
- **Icons** : Lucide React
- **Fonts** : IBM Plex Sans, IBM Plex Mono, Chivo
- **Optimise tablette** : sidebar retractable, boutons larges en caisse
- **PWA** : manifest.json + sw.js pour installation sur tablette
- **Toasts** : Sonner
- **Exports** : jsPDF + jspdf-autotable (PDF), react-csv (CSV)
- **Graphiques** : Recharts

---

## Deploiement

### Requirements backend (Python)
```
fastapi, uvicorn, motor, pymongo[srv], pydantic[email],
python-dotenv, python-multipart, httpx, bcrypt, PyJWT,
starlette, email-validator, certifi, dnspython
```

### Connexion MongoDB Atlas (important)
```python
import certifi
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
```
Sans ca, l'erreur SSL `TLSV1_ALERT_INTERNAL_ERROR` apparait sur les hebergeurs modernes (Python 3.12+).

### Start command backend
```
uvicorn server:app --host 0.0.0.0 --port $PORT
```

### Build command frontend
```
yarn install && yarn build
```

### Initialisation automatique
Au premier demarrage, le backend cree automatiquement dans MongoDB :
- Les parametres par defaut (settings)
- Les 4 roles systeme
- Les permissions par module

---

## Points d'attention pour la reprise
1. **server.py fait 3400 lignes** - idealement a decouper en routers FastAPI (`/routes/auth.py`, `/routes/members.py`, etc.)
2. **Le Google OAuth Emergent** ne fonctionnera pas en dehors d'Emergent. Il faudra implementer un Google OAuth classique ou un autre provider.
3. **Les images produits** sont stockees localement dans `/backend/uploads/products/`. En production, passer sur un stockage cloud (S3, Cloudinary).
4. **Toutes les confirmations de suppression** utilisent des dialogues UI (pas de `window.confirm`)
5. **`product_categories`** est un dictionnaire `{categorie: [sous-categories]}`, pas un tableau
6. **`pos_visible_subcategories`** controle quelles sous-categories apparaissent en caisse
7. **Les cartes (pack/snack) sont attribuees au PAIEMENT**, pas a la creation de cotisation
