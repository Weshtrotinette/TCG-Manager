import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, eventTypeLabels, eventFormatLabels } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import { Plus, MapPin, Users, Edit, Trash2, Eye, Swords } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function EventsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    location: '',
    event_type: '',
    format: '',
    max_capacity: 150,
    entry_fee: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsData, settingsData] = await Promise.all([
        api.getEvents(),
        api.getSettings(),
      ]);
      setEvents(eventsData);
      setSettings(settingsData);
    } catch (err) {
      toast.error('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        date: new Date(formData.date).toISOString(),
        max_capacity: parseInt(formData.max_capacity),
        entry_fee: parseFloat(formData.entry_fee),
      };

      if (editingEvent) {
        await api.updateEvent(editingEvent.event_id, payload);
        toast.success('Événement mis à jour');
      } else {
        await api.createEvent(payload);
        toast.success('Événement créé');
      }
      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    const date = new Date(event.date);
    setFormData({
      name: event.name,
      date: date.toISOString().slice(0, 16),
      location: event.location || '',
      event_type: event.event_type || '',
      format: event.format || '',
      max_capacity: event.max_capacity || 150,
      entry_fee: event.entry_fee || 0,
      notes: event.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (event) => {
    if (window.confirm(`Supprimer l'événement "${event.name}" ?`)) {
      try {
        await api.deleteEvent(event.event_id);
        toast.success('Événement supprimé');
        loadData();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const resetForm = () => {
    setEditingEvent(null);
    setFormData({
      name: '',
      date: '',
      location: '',
      event_type: '',
      format: '',
      max_capacity: 150,
      entry_fee: 0,
      notes: '',
    });
  };

  const openNewEventDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const eventTypes = settings?.event_types || Object.keys(eventTypeLabels);
  const eventFormats = settings?.event_formats || Object.keys(eventFormatLabels);
  const showFormat = formData.event_type === 'tournoi';

  const getStatusBadge = (event) => {
    const now = new Date();
    const eventDate = new Date(event.date);
    
    if (event.status === 'termine') {
      return <span className="status-badge status-archive">Terminé</span>;
    }
    if (eventDate < now) {
      return <span className="status-badge status-archive">Passé</span>;
    }
    if (eventDate.toDateString() === now.toDateString()) {
      return <span className="status-badge status-essai">Aujourd'hui</span>;
    }
    return <span className="status-badge status-actif">À venir</span>;
  };

  const getTypeLabel = (type) => eventTypeLabels[type] || type || '-';
  const getFormatLabel = (format) => eventFormatLabels[format] || format || '';

  return (
    <div className="space-y-6" data-testid="events-page">
      <div className="page-header">
        <h1 className="page-title">Événements</h1>
        {hasPermission('events:create') && (
          <Button onClick={openNewEventDialog} data-testid="add-event-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nouvel événement
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span>{events.length} événement(s)</span>
        <span className="text-success">
          {events.filter(e => new Date(e.date) >= new Date()).length} à venir
        </span>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="loading-spinner" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <div className="col-span-full swiss-card text-center py-8 text-muted-foreground">
              Aucun événement
            </div>
          ) : (
            events.map((event) => (
              <div 
                key={event.event_id} 
                className="swiss-card space-y-3"
                data-testid={`event-card-${event.event_id}`}
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg">{event.name}</h3>
                  {getStatusBadge(event)}
                </div>
                
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{formatDate(event.date, { weekday: 'long' })}</p>
                  {event.location && (
                    <p className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {event.participant_count || 0} / {event.max_capacity}
                  </span>
                  {event.entry_fee > 0 && (
                    <span>{formatCurrency(event.entry_fee)}</span>
                  )}
                </div>

                {(event.event_type || event.format) && (
                  <div className="flex gap-2 text-xs">
                    {event.event_type && (
                      <span className="px-2 py-0.5 bg-muted font-medium">{getTypeLabel(event.event_type)}</span>
                    )}
                    {event.format && (
                      <span className="px-2 py-0.5 bg-muted">{getFormatLabel(event.format)}</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/events/${event.event_id}`)}
                    data-testid={`view-event-${event.event_id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Détails
                  </Button>
                  {event.event_type === 'tournoi' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/events/${event.event_id}/tournament`)}
                      data-testid={`tournament-btn-${event.event_id}`}
                    >
                      <Swords className="h-4 w-4 mr-1" />
                      Tournoi
                    </Button>
                  )}
                  {hasPermission('events:update') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(event)}
                      data-testid={`edit-event-${event.event_id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {hasPermission('events:delete') && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(event)}
                      data-testid={`delete-event-${event.event_id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? "Modifier l'événement" : 'Nouvel événement'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="event-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date et heure *</Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                data-testid="event-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Lieu</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                data-testid="event-location"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_type">Type</Label>
                <Select
                  value={formData.event_type}
                  onValueChange={(value) => setFormData({ ...formData, event_type: value, format: value !== 'tournoi' ? '' : formData.format })}
                >
                  <SelectTrigger data-testid="event-type">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {eventTypeLabels[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showFormat && (
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Select
                    value={formData.format}
                    onValueChange={(value) => setFormData({ ...formData, format: value })}
                  >
                    <SelectTrigger data-testid="event-format">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eventFormats.map(fmt => (
                        <SelectItem key={fmt} value={fmt}>
                          {eventFormatLabels[fmt] || fmt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_capacity">Capacité max</Label>
                <Input
                  id="max_capacity"
                  type="number"
                  min="1"
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
                  data-testid="event-capacity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entry_fee">Frais d'inscription</Label>
                <Input
                  id="entry_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.entry_fee}
                  onChange={(e) => setFormData({ ...formData, entry_fee: e.target.value })}
                  data-testid="event-fee"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                data-testid="event-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" data-testid="save-event-btn">
                {editingEvent ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
