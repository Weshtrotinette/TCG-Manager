import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { eventFormatLabels, tournamentStatusLabels, matchStatusLabels, cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  ArrowLeft,
  Swords,
  Trophy,
  Users,
  Play,
  Check,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

export function TournamentPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [event, setEvent] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState('matches');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Match result dialog
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [matchResult, setMatchResult] = useState({ player1_score: 0, player2_score: 0 });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, tournamentData, settingsData] = await Promise.all([
        api.getEvent(eventId),
        api.getTournamentByEvent(eventId).catch(() => null),
        api.getSettings(),
      ]);
      setEvent(eventData);
      setTournament(tournamentData);
      setSettings(settingsData);

      // Pre-select format from event
      if (eventData?.format) {
        setSelectedFormat(eventData.format);
      } else if (!selectedFormat) {
        setSelectedFormat(settingsData?.event_formats?.[0] || 'suisse');
      }

      // Build eligible participants from event participations
      if (!tournamentData && eventData?.participations) {
        const isFree = !eventData.entry_fee || eventData.entry_fee === 0;
        const eligible = eventData.participations.filter(p => 
          p.is_present && (isFree || p.entry_paid)
        );
        setMembers(eligible.map(p => ({
          member_id: p.member_id,
          first_name: p.member_name?.split(' ')[0] || '',
          last_name: p.member_name?.split(' ').slice(1).join(' ') || '',
          pseudo: p.member_pseudo || '',
          display_name: p.member_name || p.member_id,
          is_present: p.is_present,
          entry_paid: p.entry_paid,
        })));
        setSelectedParticipants(eligible.map(p => p.member_id));
      }
    } catch (err) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTournament = async () => {
    if (selectedParticipants.length < 2) {
      toast.error('Il faut au moins 2 participants');
      return;
    }
    try {
      setCreating(true);
      await api.createTournament({
        event_id: eventId,
        format: selectedFormat,
        participant_ids: selectedParticipants,
      });
      toast.success('Tournoi créé');
      loadData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    try {
      await api.deleteTournament(tournament.tournament_id);
      toast.success('Tournoi supprime');
      setTournament(null);
      setDeleteDialogOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openResultDialog = (match) => {
    setEditingMatch(match);
    setMatchResult({
      player1_score: match.player1_score ?? 0,
      player2_score: match.player2_score ?? 0,
    });
    setResultDialogOpen(true);
  };

  const handleSubmitResult = async () => {
    if (!editingMatch || !tournament) return;
    try {
      await api.updateMatchResult(tournament.tournament_id, editingMatch.match_id, {
        player1_score: parseInt(matchResult.player1_score),
        player2_score: parseInt(matchResult.player2_score),
      });
      toast.success('Résultat enregistré');
      setResultDialogOpen(false);
      setEditingMatch(null);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleNextRound = async () => {
    if (!tournament) return;
    try {
      const res = await api.generateNextRound(tournament.tournament_id);
      toast.success(res.message);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleParticipant = (memberId) => {
    setSelectedParticipants(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const eventFormats = settings?.event_formats || Object.keys(eventFormatLabels);

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

  // Current round matches
  const currentRound = tournament?.current_round || 1;
  const currentRoundMatches = tournament?.matches?.filter(m => m.round_number === currentRound) || [];
  const allCurrentRoundDone = currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'termine');
  const canAdvance = allCurrentRoundDone && tournament?.status !== 'termine';

  // Group matches by round
  const matchesByRound = {};
  if (tournament?.matches) {
    for (const m of tournament.matches) {
      const r = m.round_number;
      if (!matchesByRound[r]) matchesByRound[r] = [];
      matchesByRound[r].push(m);
    }
  }

  return (
    <div className="space-y-6" data-testid="tournament-page">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/events')} data-testid="back-btn">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <Swords className="h-6 w-6 text-primary" />
            {event.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tournament
              ? `${eventFormatLabels[tournament.format] || tournament.format} - ${tournamentStatusLabels[tournament.status] || tournament.status}`
              : 'Aucun tournoi configuré'
            }
          </p>
        </div>
        {tournament && hasPermission('events:delete') && (
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)} data-testid="delete-tournament-btn">
            <Trash2 className="h-4 w-4 mr-1" />
            Supprimer
          </Button>
        )}
      </div>

      {/* No tournament yet - Setup */}
      {!tournament && (
        <div className="swiss-card space-y-6">
          <h2 className="text-lg font-bold">Configurer le tournoi</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Format du tournoi</Label>
              <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                <SelectTrigger className="w-full sm:w-64" data-testid="tournament-format-select">
                  <SelectValue />
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

            <div className="space-y-2">
              <Label>
                Participants éligibles ({selectedParticipants.length} / {members.length} sélectionnés)
              </Label>
              <p className="text-xs text-muted-foreground">
                Seuls les participants présents{event?.entry_fee > 0 ? ' et ayant payé leur inscription' : ''} sont affichés.
                Gérez les inscriptions depuis la page "Détails" de l'événement.
              </p>
              {members.length === 0 ? (
                <div className="border border-border rounded-md p-6 text-center text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="font-medium">Aucun participant éligible</p>
                  <p className="text-xs mt-1">
                    Inscrivez des participants via "Détails", cochez-les comme présents
                    {event?.entry_fee > 0 ? ' et validez le paiement' : ''}.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate(`/events/${eventId}`)}
                  >
                    Aller aux détails
                  </Button>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-border rounded-md">
                  {members.map(member => (
                    <label
                      key={member.member_id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border last:border-b-0",
                        selectedParticipants.includes(member.member_id) ? "bg-primary/5" : "hover:bg-muted"
                      )}
                      data-testid={`select-participant-${member.member_id}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(member.member_id)}
                        onChange={() => toggleParticipant(member.member_id)}
                        className="h-5 w-5 rounded border-border"
                      />
                      <span className="font-medium">{member.display_name}</span>
                      {member.pseudo && <span className="text-sm text-muted-foreground">({member.pseudo})</span>}
                      <div className="ml-auto flex gap-2 text-xs">
                        <span className="text-success">Présent</span>
                        {event?.entry_fee > 0 && <span className="text-success">Payé</span>}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={handleCreateTournament}
              disabled={creating || selectedParticipants.length < 2}
              className="w-full sm:w-auto"
              data-testid="create-tournament-btn"
            >
              <Play className="h-4 w-4 mr-2" />
              {creating ? 'Création...' : 'Lancer le tournoi'}
            </Button>
          </div>
        </div>
      )}

      {/* Tournament exists */}
      {tournament && (
        <>
          {/* Status bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="swiss-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Participants</div>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {tournament.participants?.length || 0}
              </div>
            </div>
            <div className="swiss-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Ronde</div>
              <div className="text-2xl font-bold">
                {tournament.current_round} / {tournament.total_rounds}
              </div>
            </div>
            <div className="swiss-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Matchs (ronde)</div>
              <div className="text-2xl font-bold">
                {currentRoundMatches.filter(m => m.status === 'termine').length} / {currentRoundMatches.length}
              </div>
            </div>
            <div className="swiss-card">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Statut</div>
              <div className={cn(
                "text-lg font-bold",
                tournament.status === 'en_cours' && "text-warning",
                tournament.status === 'termine' && "text-success"
              )}>
                {tournamentStatusLabels[tournament.status] || tournament.status}
              </div>
            </div>
          </div>

          {/* Next round button */}
          {canAdvance && hasPermission('events:update') && (
            <div className="flex justify-center">
              <Button onClick={handleNextRound} size="lg" data-testid="next-round-btn">
                <SkipForward className="h-5 w-5 mr-2" />
                {tournament.current_round >= tournament.total_rounds ? 'Terminer le tournoi' : `Générer la ronde ${currentRound + 1}`}
              </Button>
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="matches" data-testid="tab-matches">Matchs</TabsTrigger>
              <TabsTrigger value="standings" data-testid="tab-standings">Classement</TabsTrigger>
              <TabsTrigger value="participants" data-testid="tab-participants">Participants</TabsTrigger>
            </TabsList>

            {/* Matches Tab */}
            <TabsContent value="matches" className="space-y-4">
              {Object.keys(matchesByRound).sort((a, b) => Number(b) - Number(a)).map(roundNum => (
                <div key={roundNum} className="swiss-card">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    Ronde {roundNum}
                    {Number(roundNum) === currentRound && tournament.status !== 'termine' && (
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary font-medium">En cours</span>
                    )}
                  </h3>
                  <div className="space-y-2">
                    {matchesByRound[roundNum].map(match => (
                      <div
                        key={match.match_id}
                        className={cn(
                          "flex items-center gap-4 p-3 border border-border rounded-md transition-colors",
                          match.status === 'termine' && "bg-muted/30"
                        )}
                        data-testid={`match-${match.match_id}`}
                      >
                        {match.table_number && (
                          <span className="text-xs text-muted-foreground w-10 shrink-0">
                            T{match.table_number}
                          </span>
                        )}
                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                          <div className={cn(
                            "text-sm font-medium truncate text-right",
                            match.winner_id === match.player1_id && "text-success font-bold"
                          )}>
                            {match.player1_name || match.player1_id}
                          </div>
                          <div className="text-center w-20 shrink-0">
                            {match.status === 'termine' ? (
                              <span className="font-mono font-bold">
                                {match.player1_score} - {match.player2_score}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">vs</span>
                            )}
                          </div>
                          <div className={cn(
                            "text-sm font-medium truncate",
                            match.winner_id === match.player2_id && "text-success font-bold"
                          )}>
                            {match.player2_id 
                              ? (match.player2_name || match.player2_id) 
                              : 'BYE'}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {match.status === 'termine' ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : match.player2_id && hasPermission('events:update') ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResultDialog(match)}
                              data-testid={`enter-result-${match.match_id}`}
                            >
                              Résultat
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">BYE</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Standings Tab */}
            <TabsContent value="standings">
              <div className="swiss-card p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Joueur</TableHead>
                      <TableHead className="text-center">Pts</TableHead>
                      <TableHead className="text-center">V</TableHead>
                      <TableHead className="text-center">D</TableHead>
                      <TableHead className="text-center">N</TableHead>
                      <TableHead className="text-center">MJ</TableHead>
                      <TableHead className="text-center">Buch.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tournament.standings || []).map((s, i) => (
                      <TableRow
                        key={s.member_id}
                        className={cn(i < 3 && "font-medium")}
                        data-testid={`standing-${s.member_id}`}
                      >
                        <TableCell>
                          <span className={cn(
                            "inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-full",
                            i === 0 && "bg-yellow-500/20 text-yellow-600",
                            i === 1 && "bg-gray-300/20 text-gray-500",
                            i === 2 && "bg-orange-400/20 text-orange-600"
                          )}>
                            {s.rank || i + 1}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {i === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                            {s.member_name || s.member_id}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold">{s.points}</TableCell>
                        <TableCell className="text-center font-mono text-success">{s.wins}</TableCell>
                        <TableCell className="text-center font-mono text-destructive">{s.losses}</TableCell>
                        <TableCell className="text-center font-mono">{s.draws}</TableCell>
                        <TableCell className="text-center font-mono">{s.games_played}</TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">{s.buchholz}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Participants Tab */}
            <TabsContent value="participants">
              <div className="swiss-card p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Joueur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tournament.participants || []).map((pid, i) => (
                      <TableRow key={pid} data-testid={`participant-row-${pid}`}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">
                          {tournament.members_map?.[pid] || pid}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Result Dialog */}
      <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Résultat du match</DialogTitle>
          </DialogHeader>
          {editingMatch && (
            <div className="space-y-4">
              <div className="text-center text-sm text-muted-foreground mb-2">
                Table {editingMatch.table_number} - Ronde {editingMatch.round_number}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-4">
                <div className="space-y-2">
                  <Label className="text-center block font-medium truncate">
                    {editingMatch.player1_name}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchResult.player1_score}
                    onChange={(e) => setMatchResult({ ...matchResult, player1_score: e.target.value })}
                    className="text-center text-lg font-bold"
                    data-testid="result-player1-score"
                  />
                </div>
                <div className="pb-2 text-muted-foreground font-bold">-</div>
                <div className="space-y-2">
                  <Label className="text-center block font-medium truncate">
                    {editingMatch.player2_name}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={matchResult.player2_score}
                    onChange={(e) => setMatchResult({ ...matchResult, player2_score: e.target.value })}
                    className="text-center text-lg font-bold"
                    data-testid="result-player2-score"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResultDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSubmitResult} data-testid="confirm-result-btn">
                  <Check className="h-4 w-4 mr-1" />
                  Valider
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Tournament Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le tournoi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Supprimer ce tournoi ? Tous les matchs et resultats seront perdus. Cette action est irreversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteTournament} data-testid="confirm-delete-tournament-btn">
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
