import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDate, memberStatusLabels, paymentMethodLabels, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { 
  ArrowLeft, MapPin, Users, Calendar, Euro, Plus, Trash2, Check, X
} from 'lucide-react';
import { toast } from 'sonner';

export function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [event, setEvent] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventData, membersData] = await Promise.all([
        api.getEvent(eventId),
        api.getMembers(),
      ]);
      setEvent(eventData);
      setMembers(membersData.filter(m => m.status !== 'archive'));
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedMemberId) return;
    try {
      await api.addParticipation({
        event_id: eventId,
        member_id: selectedMemberId,
        is_present: false,
        entry_paid: false,
      });
      toast.success('Participant ajouté');
      setIsAddParticipantOpen(false);
      setSelectedMemberId('');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUpdateParticipation = async (participationId, field, value) => {
    try {
      await api.updateParticipation(participationId, { [field]: value });
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleRemoveParticipant = async (participationId) => {
    if (window.confirm('Retirer ce participant ?')) {
      try {
        await api.removeParticipation(participationId);
        toast.success('Participant retiré');
        loadData();
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const getAvailableMembers = () => {
    const participantIds = event?.participations?.map(p => p.member_id) || [];
    return members.filter(m => !participantIds.includes(m.member_id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="swiss-card text-center py-8">
        <p className="text-muted-foreground">Événement non trouvé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="event-detail-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/events')} data-testid="back-btn">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title">{event.name}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(event.date, { weekday: 'long' })}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="swiss-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Inscrits</span>
          </div>
          <div className="text-2xl font-bold">
            {event.participant_count} / {event.max_capacity}
          </div>
        </div>
        <div className="swiss-card">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Présents</div>
          <div className="text-2xl font-bold text-success">{event.present_count}</div>
        </div>
        <div className="swiss-card">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Recettes</div>
          <div className="text-2xl font-bold text-success">
            {formatCurrency(event.total_sales + event.total_entry_fees)}
          </div>
        </div>
        <div className="swiss-card">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Résultat</div>
          <div className={cn(
            "text-2xl font-bold",
            event.net_result >= 0 ? "text-success" : "text-destructive"
          )}>
            {formatCurrency(event.net_result)}
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="swiss-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Participants</h2>
          {hasPermission('participations:create') && (
            <Button onClick={() => setIsAddParticipantOpen(true)} data-testid="add-participant-btn">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participant</TableHead>
              <TableHead>Statut membre</TableHead>
              <TableHead className="text-center">Présent</TableHead>
              <TableHead className="text-center">Inscription payée</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {event.participations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Aucun participant
                </TableCell>
              </TableRow>
            ) : (
              event.participations?.map((part) => (
                <TableRow key={part.participation_id} data-testid={`participant-${part.participation_id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{part.member_name}</div>
                      {part.member_pseudo && (
                        <div className="text-xs text-muted-foreground">{part.member_pseudo}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* We'd need member status here - simplified for now */}
                    <span className="text-xs text-muted-foreground">-</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {hasPermission('participations:update') ? (
                      <Checkbox
                        checked={part.is_present}
                        onCheckedChange={(checked) => 
                          handleUpdateParticipation(part.participation_id, 'is_present', checked)
                        }
                        data-testid={`present-${part.participation_id}`}
                      />
                    ) : (
                      part.is_present ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {event.entry_fee > 0 ? (
                      hasPermission('participations:update') ? (
                        <Checkbox
                          checked={part.entry_paid}
                          onCheckedChange={(checked) => 
                            handleUpdateParticipation(part.participation_id, 'entry_paid', checked)
                          }
                          data-testid={`paid-${part.participation_id}`}
                        />
                      ) : (
                        part.entry_paid ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">Gratuit</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasPermission('participations:delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveParticipant(part.participation_id)}
                        data-testid={`remove-participant-${part.participation_id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Financial Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="swiss-card">
          <h3 className="text-lg font-bold mb-3">Recettes</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Inscriptions</span>
              <span className="font-mono">{formatCurrency(event.total_entry_fees)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ventes</span>
              <span className="font-mono">{formatCurrency(event.total_sales)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 font-bold">
              <span>Total</span>
              <span className="font-mono text-success">
                {formatCurrency(event.total_entry_fees + event.total_sales)}
              </span>
            </div>
          </div>
        </div>
        <div className="swiss-card">
          <h3 className="text-lg font-bold mb-3">Dépenses</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="font-mono text-destructive">{formatCurrency(event.total_expenses)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Participant Dialog */}
      <Dialog open={isAddParticipantOpen} onOpenChange={(open) => { setIsAddParticipantOpen(open); if (!open) { setMemberSearch(''); setSelectedMemberId(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un participant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rechercher un membre</label>
              <Input
                placeholder="Tapez un nom, pseudo ou email..."
                value={memberSearch}
                onChange={(e) => { setMemberSearch(e.target.value); setSelectedMemberId(''); }}
                autoFocus
                data-testid="member-search-input"
              />
              <div className="max-h-48 overflow-y-auto border border-border rounded-md">
                {getAvailableMembers()
                  .filter(m => {
                    if (!memberSearch) return true;
                    const q = memberSearch.toLowerCase();
                    return `${m.first_name} ${m.last_name} ${m.pseudo || ''} ${m.email || ''}`.toLowerCase().includes(q);
                  })
                  .map(member => (
                    <button
                      key={member.member_id}
                      type="button"
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm transition-colors border-b border-border last:border-b-0",
                        selectedMemberId === member.member_id
                          ? "bg-primary/10 font-semibold"
                          : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedMemberId(member.member_id)}
                      data-testid={`pick-member-${member.member_id}`}
                    >
                      <span>{member.first_name} {member.last_name}</span>
                      {member.pseudo && <span className="ml-1 text-muted-foreground">({member.pseudo})</span>}
                    </button>
                  ))}
                {getAvailableMembers().filter(m => {
                  if (!memberSearch) return true;
                  const q = memberSearch.toLowerCase();
                  return `${m.first_name} ${m.last_name} ${m.pseudo || ''} ${m.email || ''}`.toLowerCase().includes(q);
                }).length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                    Aucun membre trouvé
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddParticipantOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddParticipant} disabled={!selectedMemberId} data-testid="confirm-add-participant">
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
