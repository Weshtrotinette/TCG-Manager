# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG pour ~150 joueurs.

## Implemented Features

### Auth & Roles (DONE)
- [x] Google OAuth (Emergent) + Email/Password + Whitelist
- [x] RBAC: President, Tresorier, Organisateur, Lecture seule (defaut)

### Members (DONE)
- [x] Adherents vs Non-adherents (member_type)
- [x] Auto-status adherents: nouveau -> essai -> non_a_jour -> actif
- [x] Status non gere pour non-adherents

### Events & Tournaments (DONE)
- [x] Event CRUD, dropdown Type/Format (configurable Settings)
- [x] Tournament: Swiss (Buchholz), Single Elim (bracket), Round Robin (circle)
- [x] Participants filtres: present + paye uniquement
- [x] Searchable member dropdown dans event detail

### Cotisations (DONE)
- [x] Tableau par saison, vide a chaque nouvelle saison
- [x] Bouton "Nouvelle saison" -> archive + reset adherents en non_a_jour
- [x] Archives consultables par saison
- [x] Modifier cotisation (montant du) + Supprimer
- [x] Paiement avec recalcul auto du statut membre
- [x] Seuls les adherents dans la liste cotisations

### Finance (DONE)
- [x] POS tablette + Page Ventes (historique, annulation)
- [x] Dashboard mois = ventes seules, annee = tout compris
- [x] Rapport financier mensuel coherent (ventes + subs + inscriptions)
- [x] Expenses CRUD

### Products & POS (DONE - Updated 2026-04-16)
- [x] Categories dynamiques avec sous-categories (dict schema)
- [x] Upload photo produit (JPG/PNG/WebP/GIF, max 5Mo)
- [x] Photos visibles dans le tableau produits et en caisse
- [x] POS: regroupement par sous-categorie (ex: BOISSONS, SNACK)
- [x] Whitelist sous-categories visibles en caisse (Parametres > Caisse)
- [x] Modes de paiement dynamiques en caisse (depuis Parametres)

### Settings (DONE - Updated 2026-04-16)
- [x] Reorganisation avec 6 onglets: General, Paiements, Produits, Caisse, Evenements, Depenses
- [x] Auto-save pour les listes (modes de paiement, categories, etc.)
- [x] Whitelist POS: checkboxes pour choisir les sous-categories affichees en caisse

### UI (DONE)
- [x] Dark/Light mode, Swiss design
- [x] Sidebar retractable tablette
- [x] PWA (Progressive Web App)

## Backlog (P2)
- [ ] Portail membre self-service
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs
- [ ] Rapprochement de caisse
- [ ] Refactoring server.py -> routers

## Technical Architecture
- Frontend: React.js, Tailwind, Shadcn UI, PWA
- Backend: FastAPI (server.py ~3200 lines)
- Database: MongoDB
- Auth: Emergent Google OAuth + JWT
- File Storage: /app/backend/uploads/products/ served via /api/uploads/
