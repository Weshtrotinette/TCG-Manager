# TCG Association Manager - PRD

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG (Trading Card Game) pour ~150 joueurs. L'objectif est de centraliser la gestion des membres, des cotisations, des événements, des participations, des ventes sur place (POS/caisse), du merchandising, des dépenses et des rapports financiers.

## Core Requirements
- Authentification : Google sociale via Emergent + Email/Mot de passe
- Système de Whitelist : Seuls les emails pré-approuvés peuvent s'inscrire/se connecter
- Rôles et permissions personnalisables (Président, Trésorier, Organisateur, Lecture seule). Par défaut, les nouveaux inscrits sont "Lecture seule"
- Règle métier : 3 événements autorisés avant adhésion/cotisation obligatoire
- Ventes & Encaissement rapide (POS) pour tablettes
- Design : Dark/Light mode, interface "Swiss design", utilisation optimisée pour tablettes (90% du temps)
- Langue : Français uniquement
- Exports : PDF + CSV/Excel

## Tech Stack
- Frontend: React.js, Tailwind CSS, Shadcn UI, Recharts
- Backend: FastAPI, PyJWT, bcrypt
- Database: MongoDB (Motor async)
- Auth: Hybrid (Emergent Google OAuth + custom Email/Password JWT), Whitelist-gated

## Architecture
```
/app/backend/server.py         - Main FastAPI app (all routes)
/app/frontend/src/
  components/layout/           - Sidebar, MainLayout
  components/auth/             - AuthCallback, ProtectedRoute
  contexts/                    - AuthContext, ThemeContext
  lib/                         - api.js, utils.js
  pages/                       - All page components
```

## Implemented Features (as of 2026-04-07)

### Phase 1 - MVP Core (DONE)
- [x] Project setup (FastAPI + React)
- [x] Emergent Google OAuth integration
- [x] Email/Password authentication
- [x] Whitelist mechanism for registration/login
- [x] Role-based Access Control (RBAC) with default "lecture_seule"
- [x] Dashboard
- [x] Members CRUD with member_type (Adhérent / Non adhérent)
- [x] Events CRUD with dropdown Type/Format (configurable from Settings)
- [x] Subscriptions/Cotisations (filtered to adherents only)
- [x] Expenses CRUD
- [x] Products CRUD
- [x] POS System for quick sales
- [x] Reports page
- [x] Dark/Light mode toggle
- [x] Settings page (payment methods, expense categories, product categories, event types, event formats)
- [x] Users & Roles management
- [x] Whitelist management

### Phase 2 - Tournament System (DONE)
- [x] Tournament creation from event participants (eligible only: present + paid)
- [x] Swiss format with Buchholz tiebreaker, rematch avoidance
- [x] Single Elimination with power-of-2 bracket and byes
- [x] Round Robin with circle method (proper round distribution)
- [x] Dedicated tournament page with Matchs/Classement/Participants tabs
- [x] "Tournoi" button on event cards (only for tournament-type events)
- [x] Match result entry dialog
- [x] Next round generation
- [x] Tournament standings with rank, points, wins, losses, draws, Buchholz

### Phase 3 - Tablet Optimization (DONE)
- [x] Retractable sidebar (icon-only strip on tablet)
- [x] Touch-friendly POS grid
- [x] Searchable participant dropdown (EventDetail modal)

## DB Schema
- users: {email, name, roles, permissions, hashed_password, is_active}
- whitelist: {email, note, added_at}
- members: {first_name, last_name, pseudo, email, phone, member_type, status, participation_count}
- events: {name, date, location, event_type, format, max_capacity, entry_fee}
- participations: {event_id, member_id, is_present, entry_paid}
- expenses: {amount, category, date, event_id, comment}
- products: {name, category, price, stock, is_active}
- sales: {items, total_amount, payment_method, status, date}
- subscriptions: {member_id, season, amount, status, payment_method}
- tournaments: {event_id, format, total_rounds, current_round, status, participants, matches, standings}
- settings: {annual_subscription_amount, current_season, payment_methods, event_types, event_formats, ...}

## Backlog (P2)
- [ ] Portail membre (self-service)
- [ ] Inscriptions en ligne aux événements
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload justificatifs (dépenses)
- [ ] Rapprochement de caisse

## Refactoring Needed
- [ ] Split server.py into routers (routes/, models/)
