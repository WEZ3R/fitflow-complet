'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { clientsAPI, programsAPI, sessionsAPI, statsAPI, requestsAPI } from '@/lib/api';
import { Search, User, ArrowUp, ArrowDown, MapPin, Dumbbell, ChevronDown, ChevronUp, Droplets, Moon, Weight, Flame, Activity, MessageCircle } from 'lucide-react';
import { differenceInYears, format, subDays, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ProspectiveClient } from '@/types';
import { getMediaUrl } from '@/lib/media';


interface ClientUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface Client {
  id: string;
  user: ClientUser;
  requestStatus: string;
  requestId?: string;
  requestMessage?: string;
  profilePicture?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  goals?: string;
}

interface SessionDay {
  date: string;
  status: 'DONE' | 'DRAFT' | 'EMPTY' | 'REST';
}

interface AvgStats {
  water: number | null;
  sleep: number | null;
  weight: number | null;
  calories: number | null;
  workoutTime: number | null;
}

type SortKey = 'name' | 'age' | 'gender' | 'height' | 'weight' | 'goals' | null;
type SortDirection = 'asc' | 'desc' | null;

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

type ActiveTab = 'clients' | 'prospection';

export default function ClientsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clients');

  // Onglet "Mes Clients"
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: null });

  // Menu déroulant client
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{ sessions: SessionDay[]; stats: AvgStats } | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Onglet "Prospection"
  const [prospectiveClients, setProspectiveClients] = useState<ProspectiveClient[]>([]);
  const [prospectionLoaded, setProspectionLoaded] = useState(false);
  const [prospectionLoading, setProspectionLoading] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    filterAndSortClients();
  }, [searchTerm, statusFilter, clients, sortConfig]);

  const fetchClients = async () => {
    try {
      const response = await clientsAPI.getCoachClients();
      setClients(response.data.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProspectiveClients = async () => {
    if (prospectionLoaded) return;
    setProspectionLoading(true);
    try {
      const response = await clientsAPI.getProspectiveClients();
      setProspectiveClients(response.data.data);
      setProspectionLoaded(true);
    } catch (error) {
      console.error('Error fetching prospective clients:', error);
    } finally {
      setProspectionLoading(false);
    }
  };

  const fetchClientExpandedData = useCallback(async (clientId: string) => {
    setExpandedLoading(true);
    try {
      const today = new Date();
      const twoWeeksAgo = subDays(today, 13);
      const startDate = format(twoWeeksAgo, 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');

      // Récupérer programmes, sessions et stats en parallèle
      const [programsRes, statsRes] = await Promise.all([
        programsAPI.getCoachPrograms(),
        statsAPI.getClientStats(clientId, { startDate, endDate }),
      ]);

      // Trouver les programmes de ce client
      const clientPrograms = (programsRes.data.data || []).filter(
        (p: { clientId: string }) => p.clientId === clientId
      );

      // Récupérer les sessions de tous les programmes du client
      const allSessions: { date: string; status: string }[] = [];
      for (const program of clientPrograms) {
        try {
          const sessRes = await sessionsAPI.getByProgram(program.id, { startDate, endDate });
          allSessions.push(...(sessRes.data.data || []));
        } catch {
          // Programme sans sessions
        }
      }

      // Construire le calendrier des 14 derniers jours
      const days = eachDayOfInterval({ start: twoWeeksAgo, end: today });
      const sessionDays: SessionDay[] = days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const session = allSessions.find((s) => {
          const sDate = format(parseISO(s.date), 'yyyy-MM-dd');
          return sDate === dayStr;
        });

        if (!session) return { date: dayStr, status: 'REST' as const };
        if (session.status === 'DONE') return { date: dayStr, status: 'DONE' as const };
        return { date: dayStr, status: 'DRAFT' as const };
      });

      // Calculer les moyennes des stats
      const statsData = statsRes.data?.data || [];
      const avg: AvgStats = { water: null, sleep: null, weight: null, calories: null, workoutTime: null };

      if (statsData.length > 0) {
        const sum = { water: 0, sleep: 0, weight: 0, calories: 0, workoutTime: 0 };
        const count = { water: 0, sleep: 0, weight: 0, calories: 0, workoutTime: 0 };

        for (const s of statsData) {
          if (s.water != null) { sum.water += s.water; count.water++; }
          if (s.sleepHours != null) { sum.sleep += s.sleepHours; count.sleep++; }
          if (s.weight != null) { sum.weight += s.weight; count.weight++; }
          if (s.calories != null) { sum.calories += s.calories; count.calories++; }
          if (s.workoutTime != null) { sum.workoutTime += s.workoutTime; count.workoutTime++; }
        }

        avg.water = count.water > 0 ? Math.round((sum.water / count.water) * 10) / 10 : null;
        avg.sleep = count.sleep > 0 ? Math.round((sum.sleep / count.sleep) * 10) / 10 : null;
        avg.weight = count.weight > 0 ? Math.round((sum.weight / count.weight) * 10) / 10 : null;
        avg.calories = count.calories > 0 ? Math.round(sum.calories / count.calories) : null;
        avg.workoutTime = count.workoutTime > 0 ? Math.round(sum.workoutTime / count.workoutTime) : null;
      }

      setExpandedData({ sessions: sessionDays, stats: avg });
    } catch (error) {
      console.error('Error fetching expanded data:', error);
      setExpandedData(null);
    } finally {
      setExpandedLoading(false);
    }
  }, []);

  const handleClientClick = (client: Client) => {
    if (expandedClientId === client.id) {
      setExpandedClientId(null);
      setExpandedData(null);
    } else {
      setExpandedClientId(client.id);
      setExpandedData(null);
      // PENDING : pas de stats/sessions à charger
      if (client.requestStatus !== 'pending') {
        fetchClientExpandedData(client.id);
      }
    }
  };

  const handleAccept = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      await requestsAPI.accept(requestId);
      await fetchClients();
      setExpandedClientId(null);
    } catch {
      alert('Impossible d\'accepter la demande.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm('Refuser cette demande ?')) return;
    setActionLoading(requestId);
    try {
      await requestsAPI.reject(requestId);
      await fetchClients();
      setExpandedClientId(null);
    } catch {
      alert('Impossible de refuser la demande.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'prospection') {
      fetchProspectiveClients();
    }
  };

  const handleSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    setSortConfig({ key, direction });
  };

  const filterAndSortClients = () => {
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter(client => {
        const fullName = `${client.user.firstName} ${client.user.lastName}`.toLowerCase();
        const email = client.user.email.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((client) => {
        if (statusFilter === 'pending') return client.requestStatus === 'pending';
        if (statusFilter === 'active') return client.requestStatus === 'accepted';
        return true;
      });
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortConfig.key) {
          case 'name':
            aValue = `${a.user.firstName} ${a.user.lastName}`.toLowerCase();
            bValue = `${b.user.firstName} ${b.user.lastName}`.toLowerCase();
            break;
          case 'age':
            aValue = a.dateOfBirth ? differenceInYears(new Date(), new Date(a.dateOfBirth)) : -1;
            bValue = b.dateOfBirth ? differenceInYears(new Date(), new Date(b.dateOfBirth)) : -1;
            break;
          case 'gender':
            aValue = a.gender || '';
            bValue = b.gender || '';
            break;
          case 'height':
            aValue = a.height || -1;
            bValue = b.height || -1;
            break;
          case 'weight':
            aValue = a.weight || -1;
            bValue = b.weight || -1;
            break;
          case 'goals':
            aValue = (a.goals || '').toLowerCase();
            bValue = (b.goals || '').toLowerCase();
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredClients(filtered);
  };

  const getSortIcon = (columnKey: SortKey) => {
    if (sortConfig.key !== columnKey) return null;
    if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4 inline ml-1" />;
    if (sortConfig.direction === 'desc') return <ArrowDown className="h-4 w-4 inline ml-1" />;
    return null;
  };

  const getAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return '-';
    return differenceInYears(new Date(), new Date(dateOfBirth));
  };

  const getGender = (gender?: string) => {
    if (!gender) return '-';
    return gender.toUpperCase();
  };

  const getStatus = (client: Client) => {
    if (client.requestStatus === 'pending') return 'En attente';
    if (client.requestStatus === 'accepted') return 'Actif';
    return 'Actif';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif': return 'bg-green-100 text-green-800';
      case 'En attente': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 3) return { label: 'Même zone et même salle', color: 'bg-green-100 text-green-800' };
    if (score === 2) return { label: 'Même ville', color: 'bg-blue-100 text-blue-800' };
    return { label: 'Même salle', color: 'bg-purple-100 text-purple-800' };
  };

  const getSessionColor = (status: string) => {
    switch (status) {
      case 'DONE': return 'bg-green-500';
      case 'DRAFT': return 'bg-red-500';
      case 'REST': return 'bg-gray-200';
      default: return 'bg-gray-200';
    }
  };

  const getSessionTooltip = (status: string) => {
    switch (status) {
      case 'DONE': return 'Séance réalisée';
      case 'DRAFT': return 'Séance non réalisée';
      case 'REST': return 'Repos';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-1">
            {activeTab === 'clients'
              ? `Gérez et recherchez parmi vos ${clients.length} clients`
              : 'Trouvez des clients dans votre zone géographique'}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => handleTabChange('clients')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'clients'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Mes Clients
        </button>
        <button
          onClick={() => handleTabChange('prospection')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'prospection'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Prospection
        </button>
      </div>

      {/* Onglet Mes Clients */}
      {activeTab === 'clients' && (
        <>
          {/* Barre de recherche et filtres */}
          <Card>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select-field pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actifs</option>
                <option value="pending">En attente</option>
                <option value="former">Anciens clients</option>
              </select>
            </div>
          </Card>

          {/* Liste des clients */}
          <Card>
            {filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  {searchTerm || statusFilter !== 'all'
                    ? 'Aucun client ne correspond a votre recherche'
                    : 'Aucun client pour le moment'}
                </p>
                {!searchTerm && statusFilter === 'all' && (
                  <p className="text-sm text-gray-500">
                    Les clients vous trouveront via la recherche de coachs
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th style={{ width: '220px', minWidth: '220px' }} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('name')}>
                        Nom {getSortIcon('name')}
                      </th>
                      <th style={{ width: '100px', minWidth: '100px' }} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('age')}>
                        Age {getSortIcon('age')}
                      </th>
                      <th style={{ width: '100px', minWidth: '100px' }} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('gender')}>
                        Genre {getSortIcon('gender')}
                      </th>
                      <th style={{ width: '120px', minWidth: '120px' }} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('height')}>
                        Taille (cm) {getSortIcon('height')}
                      </th>
                      <th style={{ width: '120px', minWidth: '120px' }} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('weight')}>
                        Poids (kg) {getSortIcon('weight')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort('goals')}>
                        Objectif {getSortIcon('goals')}
                      </th>
                      <th style={{ width: '120px', minWidth: '120px' }} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th style={{ width: '50px', minWidth: '50px' }} className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredClients.map((client) => {
                      const isExpanded = expandedClientId === client.id;
                      return (
                        <tr key={client.id} className="group">
                          {/* Ligne principale du client */}
                          <td colSpan={8} className="p-0">
                            <div
                              onClick={() => handleClientClick(client)}
                              className={`flex items-center cursor-pointer transition-colors hover:bg-gray-50 ${isExpanded ? 'bg-primary-50' : ''}`}
                            >
                              <div className="px-6 py-4 whitespace-nowrap flex-shrink-0" style={{ width: '220px' }}>
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                                    {client.profilePicture ? (
                                      <img
                                        src={getMediaUrl(client.profilePicture) || undefined}
                                        alt=""
                                        className="h-10 w-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      <User className="h-5 w-5 text-primary-600" />
                                    )}
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {client.user.firstName} {client.user.lastName}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex-shrink-0" style={{ width: '100px' }}>
                                {getAge(client.dateOfBirth)} ans
                              </div>
                              <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex-shrink-0" style={{ width: '100px' }}>
                                {getGender(client.gender)}
                              </div>
                              <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex-shrink-0" style={{ width: '120px' }}>
                                {client.height || '-'}
                              </div>
                              <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex-shrink-0" style={{ width: '120px' }}>
                                {client.weight || '-'}
                              </div>
                              <div className="px-6 py-4 text-sm text-gray-900 flex-1 truncate">
                                {client.goals || '-'}
                              </div>
                              <div className="px-6 py-4 whitespace-nowrap flex-shrink-0" style={{ width: '120px' }}>
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(getStatus(client))}`}>
                                  {getStatus(client)}
                                </span>
                              </div>
                              <div className="px-4 py-4 flex-shrink-0" style={{ width: '50px' }}>
                                {isExpanded
                                  ? <ChevronUp className="h-5 w-5 text-gray-400" />
                                  : <ChevronDown className="h-5 w-5 text-gray-400" />
                                }
                              </div>
                            </div>

                            {/* Menu déroulant */}
                            {isExpanded && (
                              <div className="border-t border-gray-100 bg-gray-50 px-6 py-5">
                                {/* Déroulant client EN ATTENTE */}
                                {client.requestStatus === 'pending' ? (
                                  <div className="space-y-4">
                                    {client.requestMessage ? (
                                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex gap-3">
                                        <MessageCircle className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-indigo-900">{client.requestMessage}</p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400 italic">Aucun message joint à la demande.</p>
                                    )}
                                    <div className="flex gap-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => { e.stopPropagation(); router.push(`/coach/clients/${client.id}`); }}
                                      >
                                        Voir le profil
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 border-red-300 hover:bg-red-50"
                                        disabled={actionLoading === client.requestId}
                                        onClick={(e) => { e.stopPropagation(); client.requestId && handleReject(client.requestId); }}
                                      >
                                        {actionLoading === client.requestId ? '...' : 'Refuser'}
                                      </Button>
                                      <Button
                                        size="sm"
                                        disabled={actionLoading === client.requestId}
                                        onClick={(e) => { e.stopPropagation(); client.requestId && handleAccept(client.requestId); }}
                                      >
                                        {actionLoading === client.requestId ? '...' : 'Accepter'}
                                      </Button>
                                    </div>
                                  </div>
                                ) : expandedLoading ? (
                                  <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                                    <span className="ml-3 text-sm text-gray-500">Chargement des données...</span>
                                  </div>
                                ) : expandedData ? (
                                  <div className="space-y-4">
                                    {/* Constantes quotidiennes moyennes */}
                                    <div>
                                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        Moyennes sur 14 jours
                                      </h4>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                        <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                          <div className="p-2 bg-blue-50 rounded-lg">
                                            <Droplets className="h-4 w-4 text-blue-500" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Eau</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {expandedData.stats.water != null ? `${expandedData.stats.water} L` : '-'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                          <div className="p-2 bg-indigo-50 rounded-lg">
                                            <Moon className="h-4 w-4 text-indigo-500" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Sommeil</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {expandedData.stats.sleep != null ? `${expandedData.stats.sleep} h` : '-'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                          <div className="p-2 bg-green-50 rounded-lg">
                                            <Weight className="h-4 w-4 text-green-500" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Poids</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {expandedData.stats.weight != null ? `${expandedData.stats.weight} kg` : '-'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                          <div className="p-2 bg-orange-50 rounded-lg">
                                            <Flame className="h-4 w-4 text-orange-500" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Calories</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {expandedData.stats.calories != null ? `${expandedData.stats.calories} kcal` : '-'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                                          <div className="p-2 bg-red-50 rounded-lg">
                                            <Activity className="h-4 w-4 text-red-500" />
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Entraînement</p>
                                            <p className="text-sm font-semibold text-gray-900">
                                              {expandedData.stats.workoutTime != null ? `${expandedData.stats.workoutTime} min` : '-'}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Calendrier 2 semaines */}
                                    <div>
                                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                        Séances — 2 dernières semaines
                                      </h4>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {expandedData.sessions.map((day) => {
                                          const date = parseISO(day.date);
                                          const dayLabel = format(date, 'EEE', { locale: fr });
                                          const dayNum = format(date, 'd');
                                          const isToday = isSameDay(date, new Date());
                                          return (
                                            <div
                                              key={day.date}
                                              className="flex flex-col items-center gap-1"
                                              title={`${format(date, 'EEEE d MMMM', { locale: fr })} — ${getSessionTooltip(day.status)}`}
                                            >
                                              <span className="text-[10px] text-gray-400 uppercase">{dayLabel}</span>
                                              <div
                                                className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-medium transition-all ${getSessionColor(day.status)} ${
                                                  day.status === 'DONE' ? 'text-white' :
                                                  day.status === 'DRAFT' ? 'text-white' :
                                                  'text-gray-400'
                                                } ${isToday ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                                              >
                                                {dayNum}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                                          Réalisée
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                                          Non réalisée
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-3 h-3 rounded-sm bg-gray-200"></div>
                                          Repos
                                        </div>
                                      </div>
                                    </div>

                                    {/* Bouton voir profil */}
                                    <div className="pt-2">
                                      <Button
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/coach/clients/${client.id}`);
                                        }}
                                      >
                                        Voir le profil complet
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 text-center py-4">Aucune donnée disponible</p>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {filteredClients.length > 0 && (
            <div className="text-sm text-gray-500 text-center">
              Affichage de {filteredClients.length} client(s) sur {clients.length} au total
            </div>
          )}
        </>
      )}

      {/* Onglet Prospection */}
      {activeTab === 'prospection' && (
        <>
          {prospectionLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600">Chargement...</p>
            </div>
          ) : prospectionLoaded && prospectiveClients.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Aucun client potentiel trouvé</p>
                <p className="text-sm text-gray-500">
                  Renseignez votre ville et vos salles dans votre profil pour trouver des clients proches de vous
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/coach/profile')}
                >
                  Compléter mon profil
                </Button>
              </div>
            </Card>
          ) : prospectionLoaded ? (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nom
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ville
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Salles communes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Score
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {prospectiveClients.map((client) => {
                      const { label, color } = getScoreLabel(client.score);
                      return (
                        <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
                                {client.profilePicture ? (
                                  <img
                                    src={getMediaUrl(client.profilePicture) || undefined}
                                    alt=""
                                    className="h-10 w-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="h-5 w-5 text-primary-600" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {client.user.firstName} {client.user.lastName}
                                </div>
                                <div className="text-xs text-gray-500">{client.user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-900 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-gray-400" />
                                {client.city || '-'}
                              </span>
                              {client.matchDetails.cityMatch && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                  Même ville
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1">
                              {client.matchDetails.commonLocations.length > 0 ? (
                                client.matchDetails.commonLocations.map((loc) => (
                                  <span
                                    key={loc}
                                    className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full"
                                  >
                                    <Dumbbell className="h-3 w-3 mr-1" />
                                    {loc}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-gray-900">{client.score}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${color}`}>
                                {label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/coach/clients/${client.id}`)}
                            >
                              Contacter
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm text-gray-500 text-center">
                {prospectiveClients.length} client(s) potentiel(s) dans votre zone
              </div>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
