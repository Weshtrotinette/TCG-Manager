# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG pour ~150 joueurs.

## Implemented Features

### Auth & Roles (DONE)
- [x] Google OAuth (Emergent) + Email/Password + Whitelist
- [x] RBAC: President, Tresorier, Organisateur, Lecture seule

### Members (DONE)
- [x] Adherents vs Non-adherents, Auto-status
- [x] Colonnes Pack Tournois et Carte Snack cliquables (desaffectation)

### Events & Tournaments (DONE)
- [x] Event CRUD, Tournament Swiss/RoundRobin/Elimination
- [x] Bouton "Utiliser Pack" dans detail evenement

### Cotisations (DONE)
- [x] Montant fixe, Pack Tournois + Carte Snack en option
- [x] Cartes attribuees au paiement complet uniquement

### Pack Tournois & Carte Snack (DONE)
- [x] Attribue/cree au paiement cotisation
- [x] Pack utilisable dans detail evenement
- [x] Carte snack utilisable en caisse rapide
- [x] Desaffectation depuis la page membres (clic sur badge)

### Products & POS (DONE)
- [x] Categories/sous-categories, photos, whitelist POS
- [x] Dropdown carte snack en caisse

### Settings (DONE)
- [x] 6 onglets, Pack/Snack prix ajustables
- [x] Date renouvellement saison, cartes definitives/saisonnieres
- [x] Bouton reinitialisation donnees financieres (zone danger)

### Finance (DONE)
- [x] POS, Ventes, Depenses, Dashboard, Rapports
- [x] Suppression depenses via dialogue UI (fix window.confirm)

### UI (DONE)
- [x] Dark/Light mode, PWA, dialogues confirmation UI partout

## Backlog (P2)
- [ ] Portail membre self-service
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs
- [ ] Rapprochement de caisse
- [ ] Refactoring server.py -> routers
