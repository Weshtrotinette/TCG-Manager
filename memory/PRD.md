# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG (Trading Card Game) pour ~150 joueurs. Centralisation de la gestion des membres, cotisations, événements, participations, ventes (POS), merchandising, dépenses et rapports financiers.

## Core Requirements
- Auth : Google OAuth (Emergent) + Email/Mot de passe, Whitelist obligatoire
- Rôles : Président, Trésorier, Organisateur, Lecture seule (défaut)
- Membres : Adhérents (soumis cotisation) vs Non-adhérents (participants externes)
- Statut adhérents automatique : nouveau → essai → non_a_jour → actif
- Règle : 3 événements max avant adhésion obligatoire (configurable)
- POS tablette, Dark/Light mode, Swiss design, Français uniquement
- Exports PDF + CSV/Excel

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn UI, Recharts
- Backend: FastAPI, PyJWT, bcrypt, Motor (MongoDB async)
- Auth: Emergent Google OAuth + Email/Password JWT + Whitelist

## Implemented Features

### Core (DONE)
- [x] Dual auth (Google + Email/Password) + Whitelist
- [x] RBAC with default "lecture_seule"
- [x] Dashboard with unified financial stats
- [x] Dark/Light mode, tablet-optimized sidebar

### Members (DONE)
- [x] Adhérents vs Non-adhérents (member_type)
- [x] Auto-status: nouveau(0) → essai(1-N) → non_a_jour(>N) → actif(cotisation payée)
- [x] Status only managed for adhérents, hidden for non-adhérents
- [x] Trial alerts (warning at N-1, exceeded at N+)

### Events & Tournaments (DONE)
- [x] Event CRUD with dropdown Type/Format (configurable via Settings)
- [x] Format dropdown only appears when type = "tournoi"
- [x] Tournament system: Swiss (Buchholz), Single Elimination (bracket), Round Robin (circle method)
- [x] Dedicated tournament page: Matchs / Classement / Participants tabs
- [x] Tournament participants from event detail (present + paid only)
- [x] Searchable participant dropdown in event detail

### Finance (DONE)
- [x] Subscriptions/Cotisations (adherents only)
- [x] POS system for quick sales
- [x] Sales history page with cancel/refund capability
- [x] Expenses CRUD
- [x] Financial reports with consistent monthly/annual totals (sales + subs + entry fees)
- [x] Dashboard financials match report totals

### Settings (DONE)
- [x] Payment methods, expense/product categories
- [x] Event types and formats (editable lists)
- [x] Season, subscription amount, free participation limit

## DB Schema
- users, whitelist, members (with member_type), events (with event_type/format)
- participations, subscriptions, sales, expenses, products
- tournaments (matches, standings, participants)
- settings, roles, permissions, audit_logs

## Backlog (P2)
- [ ] Portail membre self-service
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs
- [ ] Rapprochement de caisse
- [ ] Refactoring server.py → routers
