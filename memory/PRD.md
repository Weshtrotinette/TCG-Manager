# TCG Manager - PRD (Product Requirements Document)

## Original Problem Statement
Application web interne de gestion d'une association de tournois TCG (Trading Card Games).
Dashboard administratif pour gérer jusqu'à 150 joueurs par événement avec:
- Membres et cotisations
- Événements/tournois et participations
- Ventes de consommables et merchandising (POS)
- Gestion des stocks
- Dépenses et rapports financiers
- Système de rôles et permissions dynamiques

## User Choices
- **Authentification**: Google OAuth via Emergent
- **Design**: Dark/Light mode avec switch
- **Langue**: Français uniquement
- **Exports**: PDF + CSV/Excel

## User Personas

### Président
- Accès complet à toutes les fonctionnalités
- Gestion des utilisateurs, rôles et permissions
- Supervision globale de l'association

### Trésorier
- Suivi des cotisations et paiements
- Gestion des dépenses
- Rapports financiers et exports

### Organisateur
- Gestion des événements et tournois
- Inscription des participants
- Encaissements pendant les événements

### Lecture seule
- Consultation des tableaux de bord et listes
- Aucun droit de modification

## Core Requirements (Static)

### Must Have (MVP)
- [x] Authentification Google OAuth
- [x] Gestion des membres avec règle des 3 événements
- [x] Gestion des cotisations avec paiements partiels
- [x] Gestion des événements et participations
- [x] Interface d'encaissement rapide (POS)
- [x] Gestion des produits avec stocks
- [x] Gestion des dépenses
- [x] Tableau de bord synthétique
- [x] Rôles et permissions dynamiques
- [x] Paramétrage configurable
- [x] Exports CSV

### Should Have
- [x] Exports PDF pour rapports financiers
- [x] Alertes visuelles (stock bas, membres à régulariser)
- [x] Dark/Light mode
- [x] Interface responsive

### Nice to Have
- [ ] Portail membre
- [ ] Inscriptions en ligne
- [ ] Paiement en ligne
- [ ] QR code accueil
- [ ] Upload de justificatifs
- [ ] Statistiques avancées

## What's Been Implemented

### 2026-04-07 - MVP Initial Release
**Backend (FastAPI + MongoDB)**
- Authentication via Emergent Google OAuth
- User management with roles (president, tresorier, organisateur, lecture_seule)
- Dynamic permissions system
- Members CRUD with trial rule (3 events before membership)
- Subscriptions with partial payments support
- Events and participations management
- Products with stock tracking
- POS (Point of Sale) for quick checkout
- Expenses management with categories
- Dashboard statistics API
- Financial reports API
- Settings API (configurable parameters)
- Audit logging for sensitive actions

**Frontend (React + Tailwind + Shadcn)**
- Swiss design system (Chivo + IBM Plex Sans fonts)
- Dark/Light mode toggle
- Login page with Google OAuth
- Dashboard with KPIs and charts
- Members management with alerts
- Subscriptions with payment modal
- Events list and detail pages
- POS interface for quick sales
- Products and stock management
- Expenses tracking
- Financial reports with charts
- PDF export (jspdf)
- CSV export
- Settings configuration
- Users and roles management (admin only)

## Architecture

### Tech Stack
- **Backend**: FastAPI (Python 3.x)
- **Database**: MongoDB
- **Frontend**: React 19 with React Router
- **Styling**: Tailwind CSS + Shadcn UI
- **Charts**: Recharts
- **PDF Generation**: jsPDF with autoTable
- **Authentication**: Emergent Google OAuth

### API Structure
All endpoints prefixed with `/api/`:
- `/api/auth/*` - Authentication
- `/api/users/*` - User management
- `/api/roles/*` - Roles management
- `/api/permissions` - Permissions list
- `/api/members/*` - Members CRUD
- `/api/subscriptions/*` - Subscriptions
- `/api/events/*` - Events CRUD
- `/api/participations/*` - Participations
- `/api/products/*` - Products CRUD
- `/api/sales/*` - Sales (POS)
- `/api/expenses/*` - Expenses CRUD
- `/api/dashboard` - Dashboard stats
- `/api/reports/*` - Financial reports
- `/api/settings` - App settings
- `/api/audit-logs` - Audit trail

## Prioritized Backlog

### P0 - Critical (Completed)
- [x] Core authentication flow
- [x] Members management
- [x] Events and participations
- [x] POS functionality
- [x] Basic financial tracking

### P1 - High Priority
- [ ] Email notifications for trial alerts
- [ ] Batch import/export of members
- [ ] Event check-in with barcode/QR
- [ ] Mobile-optimized POS view
- [ ] Recurring events support

### P2 - Medium Priority
- [ ] Member portal (self-service)
- [ ] Online registration
- [ ] Payment integration (Stripe)
- [ ] Advanced reporting (trends, comparisons)
- [ ] Multi-season historical data

### P3 - Low Priority
- [ ] Club network federation
- [ ] Tournament bracket management
- [ ] Player ranking system
- [ ] Social features (comments, likes)

## Next Tasks List

1. **Add email notifications** for:
   - Trial limit approaching (2/3 events)
   - Trial limit exceeded
   - Subscription renewal reminder

2. **Enhance POS experience**:
   - Add quick-add buttons for common items
   - Receipt printing/email
   - Cash drawer integration

3. **Improve reporting**:
   - Year-over-year comparison
   - Event profitability analysis
   - Member retention metrics

4. **Mobile optimization**:
   - Full responsive design for tablets
   - PWA support for offline POS

5. **Data management**:
   - Bulk member import (CSV)
   - Data backup/restore UI
   - GDPR export/delete features
