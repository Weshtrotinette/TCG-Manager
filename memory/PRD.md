# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG pour ~150 joueurs.

## Implemented Features

### Auth & Roles (DONE)
- [x] Google OAuth (Emergent) + Email/Password + Whitelist
- [x] RBAC: President, Tresorier, Organisateur, Lecture seule

### Members (DONE)
- [x] Adherents vs Non-adherents, Auto-status

### Events & Tournaments (DONE)
- [x] Event CRUD, Tournament Swiss/RoundRobin/Elimination
- [x] Format preselectionne, BYE fix, suppression via dialog

### Cotisations (DONE - Updated 2026-04-16)
- [x] Montant fixe depuis les parametres (non editable)
- [x] Checkbox Pack Tournois + Carte Snack lors de la creation
- [x] Cartes attribuees UNIQUEMENT au paiement complet (pas a la creation)
- [x] Saison, archives, paiements partiels

### Pack Tournois (NEW 2026-04-16)
- [x] Attribue au membre quand cotisation payee (1 seul par membre)
- [x] Utilisable lors du reglement d'un evenement
- [x] Parametre: prix ajustable + definitif ou saisonnier

### Carte Snack (NEW 2026-04-16)
- [x] Creee quand cotisation payee (prix 10EUR, valeur 12EUR par defaut)
- [x] Membre peut avoir plusieurs cartes
- [x] Utilisable en caisse rapide via dropdown membre
- [x] Deduction partielle (reste paye par autre moyen)
- [x] Parametre: prix/valeur ajustables + definitif ou saisonnier

### Settings (DONE - Updated 2026-04-16)
- [x] 6 onglets, auto-save listes
- [x] Pack Tournois prix, Carte Snack prix/valeur, cartes definitives toggle
- [x] Date renouvellement saison (jour/mois)

### Products & POS (DONE)
- [x] Categories/sous-categories, photos, whitelist POS, paiements dynamiques
- [x] Dropdown carte snack en caisse rapide

### UI (DONE)
- [x] Dark/Light mode, PWA, dialogues confirmation UI

## Backlog (P2)
- [ ] Pack tournois: utilisation dans EventDetailPage (checkbox lors du paiement inscription)
- [ ] Portail membre self-service
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs
- [ ] Rapprochement de caisse
- [ ] Refactoring server.py -> routers
