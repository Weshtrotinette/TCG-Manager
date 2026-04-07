import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, monthNames, generateCSV, downloadFile } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { Download, FileText, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const CHART_COLORS = ['hsl(222, 100%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(4, 90%, 58%)', 'hsl(48, 100%, 50%)', 'hsl(262, 83%, 58%)'];

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const [reportData, setReportData] = useState(null);
  const [membersData, setMembersData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  useEffect(() => {
    loadReport();
  }, [selectedYear]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const [financial, members] = await Promise.all([
        api.getFinancialReport(selectedYear),
        api.getMembersReport(),
      ]);
      setReportData(financial);
      setMembersData(members);
    } catch (err) {
      toast.error('Erreur lors du chargement du rapport');
    } finally {
      setLoading(false);
    }
  };

  const exportMembersCSV = () => {
    const headers = [
      { key: 'first_name', label: 'Prénom' },
      { key: 'last_name', label: 'Nom' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Téléphone' },
      { key: 'status', label: 'Statut' },
      { key: 'participation_count', label: 'Participations' },
      { key: 'subscription_status', label: 'Cotisation' },
      { key: 'subscription_amount_paid', label: 'Montant payé' },
    ];
    const csv = generateCSV(membersData, headers);
    downloadFile(csv, `membres_${selectedYear}.csv`);
    toast.success('Export CSV généré');
  };

  const exportFinancialCSV = () => {
    if (!reportData) return;
    
    const data = reportData.monthly.map(m => ({
      mois: monthNames[m.month - 1],
      recettes: m.revenue,
      depenses: m.expenses,
      resultat: m.result,
    }));
    
    const headers = [
      { key: 'mois', label: 'Mois' },
      { key: 'recettes', label: 'Recettes' },
      { key: 'depenses', label: 'Dépenses' },
      { key: 'resultat', label: 'Résultat' },
    ];
    
    const csv = generateCSV(data, headers);
    downloadFile(csv, `rapport_financier_${selectedYear}.csv`);
    toast.success('Export CSV généré');
  };

  const exportFinancialPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text(`Rapport Financier ${selectedYear}`, 14, 22);
    
    // Summary
    doc.setFontSize(12);
    doc.text('Résumé annuel', 14, 35);
    
    doc.setFontSize(10);
    doc.text(`Recettes totales: ${formatCurrency(reportData.revenue.total)}`, 14, 45);
    doc.text(`Dépenses totales: ${formatCurrency(reportData.expenses.total)}`, 14, 52);
    doc.text(`Résultat net: ${formatCurrency(reportData.result)}`, 14, 59);
    
    // Revenue breakdown
    doc.setFontSize(12);
    doc.text('Détail des recettes', 14, 75);
    
    const revenueData = Object.entries(reportData.revenue.by_category).map(([key, value]) => [
      key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      formatCurrency(value)
    ]);
    
    doc.autoTable({
      startY: 80,
      head: [['Catégorie', 'Montant']],
      body: revenueData,
      theme: 'grid',
      headStyles: { fillColor: [0, 47, 167] },
    });
    
    // Expense breakdown
    doc.setFontSize(12);
    doc.text('Détail des dépenses', 14, doc.lastAutoTable.finalY + 15);
    
    const expenseData = Object.entries(reportData.expenses.by_category).map(([key, value]) => [
      key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      formatCurrency(value)
    ]);
    
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Catégorie', 'Montant']],
      body: expenseData,
      theme: 'grid',
      headStyles: { fillColor: [0, 47, 167] },
    });
    
    // Monthly breakdown
    doc.addPage();
    doc.setFontSize(12);
    doc.text('Détail mensuel', 14, 22);
    
    const monthlyData = reportData.monthly.map(m => [
      monthNames[m.month - 1],
      formatCurrency(m.revenue),
      formatCurrency(m.expenses),
      formatCurrency(m.result)
    ]);
    
    doc.autoTable({
      startY: 27,
      head: [['Mois', 'Recettes', 'Dépenses', 'Résultat']],
      body: monthlyData,
      theme: 'grid',
      headStyles: { fillColor: [0, 47, 167] },
    });
    
    doc.save(`rapport_financier_${selectedYear}.pdf`);
    toast.success('Export PDF généré');
  };

  const monthlyChartData = reportData?.monthly.map(m => ({
    name: monthNames[m.month - 1].substring(0, 3),
    Recettes: m.revenue,
    Dépenses: m.expenses,
  })) || [];

  const revenueChartData = reportData ? Object.entries(reportData.revenue.by_category)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' '),
      value,
    })) : [];

  const expenseChartData = reportData ? Object.entries(reportData.expenses.by_category)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: key.replace(/_/g, ' '),
      value,
    })) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="page-header">
        <h1 className="page-title">Rapports & Exports</h1>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-32" data-testid="year-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="swiss-card">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Recettes {selectedYear}
          </div>
          <div className="text-3xl font-black text-success">
            {formatCurrency(reportData?.revenue.total || 0)}
          </div>
        </div>
        <div className="swiss-card">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Dépenses {selectedYear}
          </div>
          <div className="text-3xl font-black text-destructive">
            {formatCurrency(reportData?.expenses.total || 0)}
          </div>
        </div>
        <div className="swiss-card">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Résultat {selectedYear}
          </div>
          <div className={`text-3xl font-black ${(reportData?.result || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(reportData?.result || 0)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Chart */}
        <div className="swiss-card">
          <h3 className="text-lg font-bold mb-4">Évolution mensuelle</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="Recettes" fill="hsl(142, 71%, 45%)" />
                <Bar dataKey="Dépenses" fill="hsl(4, 90%, 58%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="swiss-card">
          <h3 className="text-lg font-bold mb-4">Répartition des recettes</h3>
          <div className="h-64">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {revenueChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Aucune donnée
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="swiss-card">
        <h3 className="text-lg font-bold mb-4">Répartition des dépenses</h3>
        <div className="h-64">
          {expenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {expenseChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Aucune donnée
            </div>
          )}
        </div>
      </div>

      {/* Export Buttons */}
      {hasPermission('reports:export') && (
        <div className="swiss-card">
          <h3 className="text-lg font-bold mb-4">Exports</h3>
          <div className="flex flex-wrap gap-4">
            <Button onClick={exportFinancialPDF} data-testid="export-financial-pdf">
              <FileText className="h-4 w-4 mr-2" />
              Rapport financier (PDF)
            </Button>
            <Button variant="outline" onClick={exportFinancialCSV} data-testid="export-financial-csv">
              <TableIcon className="h-4 w-4 mr-2" />
              Rapport financier (CSV)
            </Button>
            <Button variant="outline" onClick={exportMembersCSV} data-testid="export-members-csv">
              <Download className="h-4 w-4 mr-2" />
              Liste des membres (CSV)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
