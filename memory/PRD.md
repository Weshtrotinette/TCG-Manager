# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG pour ~150 joueurs.

## Implemented Features

### Auth & Roles (DONE)
- [x] Google OAuth (Emergent) + Email/Password + Whitelist
- [x] RBAC: Président, Trésorier, Organisateur, Lecture seule (défaut)

### Members (DONE)
- [x] Adhérents vs Non-adhérents (member_type)
- [x] Auto-status adhérents: nouveau → essai → non_a_jour → actif
- [x] Status non géré pour non-adhérents

### Events & Tournaments (DONE)
- [x] Event CRUD, dropdown Type/Format (configurable Settings)
- [x] Tournament: Swiss (Buchholz), Single Elim (bracket), Round Robin (circle)
- [x] Participants filtrés: présent + payé uniquement
- [x] Searchable member dropdown dans event detail

### Cotisations (DONE)
- [x] Tableau par saison, vidé à chaque nouvelle saison
- [x] Bouton "Nouvelle saison" → archive + reset adhérents en non_a_jour
- [x] Archives consultables par saison
- [x] Modifier cotisation (montant dû) + Supprimer
- [x] Paiement avec recalcul auto du statut membre
- [x] Seuls les adhérents dans la liste cotisations

### Finance (DONE)
- [x] POS tablette + Page Ventes (historique, annulation)
- [x] Dashboard mois = ventes seules, année = tout compris
- [x] Rapport financier mensuel cohérent (ventes + subs + inscriptions)
- [x] Expenses CRUD

### UI (DONE)
- [x] Dark/Light mode, Swiss design
- [x] Sidebar rétractable tablette
- [x] Settings: listes configurables

## Backlog (P2)
- [ ] Portail membre self-service
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs
- [ ] Rapprochement de caisse
- [ ] Refactoring server.py → routers
