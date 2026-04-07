import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format currency in EUR
export function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount || 0);
}

// Format date in French
export function formatDate(date, options = {}) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

// Format datetime in French
export function formatDateTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get relative time (e.g., "il y a 2 heures")
export function getRelativeTime(date) {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  return formatDate(date);
}

// Member status labels in French
export const memberStatusLabels = {
  nouveau: 'Nouveau',
  essai: 'En essai',
  actif: 'Actif',
  non_a_jour: 'Non à jour',
  archive: 'Archivé',
};

// Member type labels
export const memberTypeLabels = {
  adherent: 'Adhérent',
  non_adherent: 'Non adhérent',
};

// Event type labels
export const eventTypeLabels = {
  tournoi: 'Tournoi',
  ligue: 'Ligue',
  session_libre: 'Session libre',
  demonstration: 'Démonstration',
  atelier: 'Atelier',
};

// Event format labels
export const eventFormatLabels = {
  suisse: 'Suisse',
  elimination_simple: 'Élimination simple',
  double_elimination: 'Double élimination',
  round_robin: 'Round Robin',
  poules_top_cut: 'Poules + Top Cut',
};

// Tournament status labels
export const tournamentStatusLabels = {
  inscription: 'Inscription',
  en_cours: 'En cours',
  termine: 'Terminé',
};

// Match status labels
export const matchStatusLabels = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  termine: 'Terminé',
};

// Payment method labels in French
export const paymentMethodLabels = {
  especes: 'Espèces',
  carte: 'Carte bancaire',
  virement: 'Virement',
  paypal: 'PayPal',
  cheque: 'Chèque',
  autre: 'Autre',
};

// Expense category labels in French
export const expenseCategoryLabels = {
  consommables: 'Achats consommables',
  merchandising: 'Achats merchandising',
  location: 'Location de salle',
  lots: 'Lots et récompenses',
  materiel: 'Matériel',
  communication: 'Communication',
  divers: 'Frais divers',
};

// Product category labels in French
export const productCategoryLabels = {
  boissons: 'Boissons',
  nourriture: 'Nourriture',
  formules: 'Formules',
  accessoires: 'Accessoires',
  textile: 'Textile',
  goodies: 'Goodies',
  autres: 'Autres',
};

// Subscription status labels
export const subscriptionStatusLabels = {
  non_payee: 'Non payée',
  partielle: 'Partielle',
  payee: 'Payée',
};

// French month names
export const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Generate CSV content
export function generateCSV(data, headers) {
  const headerRow = headers.map(h => h.label).join(';');
  const rows = data.map(item => 
    headers.map(h => {
      let value = item[h.key];
      if (typeof value === 'string' && value.includes(';')) {
        value = `"${value}"`;
      }
      return value ?? '';
    }).join(';')
  );
  return [headerRow, ...rows].join('\n');
}

// Download file
export function downloadFile(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
