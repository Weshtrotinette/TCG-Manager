# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG pour ~150 joueurs.

## Implemented Features

### Auth & Roles (DONE)
- [x] Google OAuth (Emergent) + Email/Password + Whitelist
- [x] RBAC: President, Tresorier, Organisateur, Lecture seule

### Members (DONE - Updated 2026-04-16)
- [x] Adherents vs Non-adherents, Auto-status
- [x] Colonnes Pack Tournois et Carte Snack dans la liste membres
- [x] Solde carte snack affiche en temps reel

### Events & Tournaments (DONE - Updated 2026-04-16)
- [x] Event CRUD, Tournament Swiss/RoundRobin/Elimination
- [x] Colonne "Pack T." dans le detail evenement
- [x] Bouton "Utiliser Pack" pour les membres ayant un pack tournois
- [x] "Pack utilise" affiche en vert quand consomme

### Cotisations (DONE)
- [x] Montant fixe depuis les parametres
- [x] Checkbox Pack Tournois + Carte Snack
- [x] Cartes attribuees au paiement complet uniquement

### Pack Tournois (DONE)
- [x] Attribue au paiement de cotisation (1 par membre)
- [x] Utilisable via bouton dans le detail evenement
- [x] Consomme le pack et marque la participation

### Carte Snack (DONE)
- [x] Creee au paiement de cotisation (multiples possibles)
- [x] Dropdown en caisse rapide avec solde
- [x] Deduction partielle, reste paye par autre moyen

### Settings (DONE)
- [x] 6 onglets, Pack/Snack prix ajustables
- [x] Cartes definitives ou saisonnieres
- [x] Date renouvellement saison jour/mois

### Products & POS (DONE)
- [x] Categories/sous-categories, photos, whitelist POS

### UI (DONE)
- [x] Dark/Light mode, PWA, dialogues confirmation

## Backlog (P2)
- [ ] Portail membre self-service
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs
- [ ] Rapprochement de caisse
- [ ] Refactoring server.py -> routers
