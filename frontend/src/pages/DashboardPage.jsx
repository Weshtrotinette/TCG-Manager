import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, memberStatusLabels, getRelativeTime } from '../lib/utils';
import { 
  Users, TrendingUp, TrendingDown, Calendar, AlertTriangle, 
  Package, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { cn } from '../lib/utils';

const CHART_COLORS = ['hsl(222, 100%, 50%)', 'hsl(142, 71%, 45%)', 'hsl(4, 90%, 58%)', 'hsl(48, 100%, 50%)'];

export function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const dashboardData = await api.getDashboard();
      setData(dashboardData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="swiss-card bg-destructive/10 text-destructive">
        <p>Erreur: {error}</p>
      </div>
    );
  }

  const monthlyResult = data?.financials?.month?.result || 0;
  const yearlyResult = data?.financials?.year?.result || 0;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Tableau de bord</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Members */}
        <div className="kpi-card" data-testid="kpi-members">
          <div className="flex items-center justify-between">
            <Users className="h-5 w-5 text-primary" />
            {data?.members?.trial_alert > 0 && (
              <span className="alert-badge alert-badge-warning">
                <AlertTriangle className="h-3 w-3" />
                {data.members.trial_alert}
              </span>
            )}
          </div>
          <div className="kpi-value mt-2">{data?.members?.total || 0}</div>
          <div className="kpi-label">Membres</div>
          <div className="mt-3 flex gap-4 text-xs">
            <span className="text-success">{data?.members?.active || 0} actifs</span>
            <span className="text-warning">{data?.members?.trial || 0} essai</span>
            <span className="text-destructive">{data?.members?.non_paid || 0} non à jour</span>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="kpi-card" data-testid="kpi-month-revenue">
          <div className="flex items-center justify-between">
            <TrendingUp className="h-5 w-5 text-success" />
          </div>
          <div className="kpi-value mt-2">{formatCurrency(data?.financials?.month?.revenue || 0)}</div>
          <div className="kpi-label">Recettes du mois</div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className={cn(
              "flex items-center gap-1",
              monthlyResult >= 0 ? "text-success" : "text-destructive"
            )}>
              {monthlyResult >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {formatCurrency(monthlyResult)} résultat
            </span>
          </div>
        </div>

        {/* Monthly Expenses */}
        <div className="kpi-card" data-testid="kpi-month-expenses">
          <div className="flex items-center justify-between">
            <TrendingDown className="h-5 w-5 text-destructive" />
          </div>
          <div className="kpi-value mt-2">{formatCurrency(data?.financials?.month?.expenses || 0)}</div>
          <div className="kpi-label">Dépenses du mois</div>
        </div>

        {/* Upcoming Events */}
        <div className="kpi-card" data-testid="kpi-events">
          <div className="flex items-center justify-between">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="kpi-value mt-2">{data?.upcoming_events?.length || 0}</div>
          <div className="kpi-label">Événements à venir</div>
          {data?.upcoming_events?.[0] && (
            <div className="mt-3 text-xs text-muted-foreground">
              Prochain: {data.upcoming_events[0].name} ({formatDate(data.upcoming_events[0].date)})
            </div>
          )}
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Annual Summary */}
        <div className="swiss-card" data-testid="annual-summary">
          <h3 className="text-lg font-bold mb-4">Bilan annuel</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-success">
                {formatCurrency(data?.financials?.year?.revenue || 0)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Recettes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(data?.financials?.year?.expenses || 0)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Dépenses</div>
            </div>
            <div>
              <div className={cn(
                "text-2xl font-bold",
                yearlyResult >= 0 ? "text-success" : "text-destructive"
              )}>
                {formatCurrency(yearlyResult)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Résultat</div>
            </div>
          </div>
        </div>

        {/* Subscriptions Summary */}
        <div className="swiss-card" data-testid="subscriptions-summary">
          <h3 className="text-lg font-bold mb-4">
            Cotisations {data?.subscriptions?.season}
          </h3>
          <div className="flex items-center gap-8">
            <div className="flex-1">
              <div className="h-2 bg-muted overflow-hidden">
                <div 
                  className="h-full bg-success"
                  style={{ 
                    width: `${((data?.subscriptions?.paid || 0) / Math.max((data?.subscriptions?.paid || 0) + (data?.subscriptions?.partial || 0), 1)) * 100}%` 
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs">
                <span className="text-success">{data?.subscriptions?.paid || 0} payées</span>
                <span className="text-warning">{data?.subscriptions?.partial || 0} partielles</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Third Row - Alerts and Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Alerts */}
        <div className="swiss-card" data-testid="low-stock-alerts">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-warning" />
            <h3 className="text-lg font-bold">Alertes stock bas</h3>
          </div>
          {data?.low_stock_alerts?.length > 0 ? (
            <ul className="space-y-2">
              {data.low_stock_alerts.map((item) => (
                <li key={item.product_id} className="flex items-center justify-between py-2 border-b border-border">
                  <span>{item.name}</span>
                  <span className="alert-badge alert-badge-warning">
                    {item.stock_quantity} restants
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune alerte</p>
          )}
        </div>

        {/* Recent Sales */}
        <div className="swiss-card" data-testid="recent-sales">
          <h3 className="text-lg font-bold mb-4">Ventes récentes</h3>
          {data?.recent_sales?.length > 0 ? (
            <ul className="space-y-2">
              {data.recent_sales.slice(0, 5).map((sale) => (
                <li key={sale.sale_id} className="flex items-center justify-between py-2 border-b border-border">
                  <div>
                    <span className="text-sm">
                      {sale.items?.map(i => i.product_name).join(', ')}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {getRelativeTime(sale.created_at)}
                    </span>
                  </div>
                  <span className="font-bold">{formatCurrency(sale.total_amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune vente récente</p>
          )}
        </div>
      </div>

      {/* Upcoming Events List */}
      {data?.upcoming_events?.length > 0 && (
        <div className="swiss-card" data-testid="upcoming-events">
          <h3 className="text-lg font-bold mb-4">Événements à venir</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.upcoming_events.map((event) => (
              <div key={event.event_id} className="border border-border p-4">
                <h4 className="font-bold">{event.name}</h4>
                <p className="text-sm text-muted-foreground">{formatDate(event.date)}</p>
                {event.location && (
                  <p className="text-xs text-muted-foreground mt-1">{event.location}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs">
                  <span>{event.participant_count || 0} inscrits</span>
                  {event.entry_fee > 0 && (
                    <span>{formatCurrency(event.entry_fee)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
