'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { coachesAPI } from '@/lib/api';
import { GYM_CHAINS } from '@/lib/locations';
import { Search, MapPin, Wifi, Dumbbell, User } from 'lucide-react';
import { getMediaUrl } from '@/lib/media';


interface CoachUser {
  firstName: string;
  lastName: string;
}

interface Post {
  id?: string;
  mediaUrl?: string;
  mediaType?: string;
  isPublic?: boolean;
}

interface Coach {
  id: string;
  bio?: string;
  city?: string;
  trainingLocations?: string[];
  isRemote?: boolean;
  rating: number;
  ratingCount: number;
  profilePicture?: string;
  user: CoachUser;
  posts?: Post[];
}

interface ClientProfile {
  coachId?: string;
  coaches?: Array<{ coachId?: string }>;
}

export default function CoachSearchPage() {
  const router = useRouter();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [filteredCoaches, setFilteredCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [gymFilter, setGymFilter] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);

  useEffect(() => {
    fetchCoaches();
    fetchClientProfile();
  }, []);

  const fetchClientProfile = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiUrl}/clients/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setClientProfile(data.data);
      }
    } catch (error) {
      console.error('Error fetching client profile:', error);
    }
  };

  useEffect(() => {
    filterCoaches();
  }, [searchTerm, cityFilter, gymFilter, remoteFilter, coaches]);

  const fetchCoaches = async () => {
    try {
      const response = await coachesAPI.getAll();
      setCoaches(response.data.data);
    } catch (error) {
      console.error('Error fetching coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCoaches = () => {
    let filtered = [...coaches];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((coach) => {
        const fullName = `${coach.user.firstName} ${coach.user.lastName}`.toLowerCase();
        return fullName.includes(search);
      });
    }

    if (cityFilter) {
      filtered = filtered.filter(
        (coach) =>
          coach.city &&
          coach.city.toLowerCase().includes(cityFilter.toLowerCase())
      );
    }

    if (gymFilter) {
      filtered = filtered.filter(
        (coach) => coach.trainingLocations?.includes(gymFilter)
      );
    }

    if (remoteFilter !== 'all') {
      if (remoteFilter === 'remote') {
        filtered = filtered.filter((coach) => coach.isRemote);
      } else if (remoteFilter === 'onsite') {
        filtered = filtered.filter((coach) => !coach.isRemote);
      }
    }

    setFilteredCoaches(filtered);
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Trouver un Coach
        </h1>
        <p className="text-gray-600 mt-1">
          Recherchez parmi {coaches.length} coachs disponibles
        </p>
      </div>

      {/* Filtres */}
      <Card>
        <div className="space-y-4">
          {/* Barre de recherche principale */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
            />
          </div>

          {/* Filtres secondaires */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtre ville */}
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Ville..."
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filtre salle */}
            <div className="relative">
              <Dumbbell className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={gymFilter}
                onChange={(e) => setGymFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
              >
                <option value="">Toutes les salles</option>
                {GYM_CHAINS.map((gym) => (
                  <option key={gym} value={gym}>{gym}</option>
                ))}
              </select>
            </div>

            {/* Filtre coaching à distance */}
            <div className="relative">
              <Wifi className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <select
                value={remoteFilter}
                onChange={(e) => setRemoteFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none"
              >
                <option value="all">Tous les types</option>
                <option value="remote">À distance uniquement</option>
                <option value="onsite">En présentiel uniquement</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Résultats */}
      {filteredCoaches.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {coaches.length === 0
                ? 'Aucun coach disponible pour le moment'
                : 'Aucun coach ne correspond à votre recherche'}
            </p>
            {coaches.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCityFilter('');
                  setGymFilter('');
                  setRemoteFilter('all');
                }}

              >
                Réinitialiser les filtres
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCoaches.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                onNavigate={(path: string) => router.push(path)}
                isCurrentCoach={clientProfile?.coaches?.some(c => c.coachId === coach.id) ?? false}
              />
            ))}
          </div>

          {/* Compteur de résultats */}
          <div className="text-sm text-gray-500 text-center">
            Affichage de {filteredCoaches.length} coach(s) sur{' '}
            {coaches.length} au total
          </div>
        </>
      )}
    </div>
  );
}

// Composant carte de coach
function CoachCard({ coach, onNavigate, isCurrentCoach }: { coach: Coach; onNavigate: (path: string) => void; isCurrentCoach: boolean }) {
  const previewPosts = coach.posts?.filter((p) => p.isPublic).slice(0, 3) || [];

  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative"
      onClick={() => onNavigate(`/client/coach/${coach.id}`)}
    >
      {/* Badge "Mon coach" */}
      {isCurrentCoach && (
        <div className="absolute top-2 right-2 z-10 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
          Mon Coach
        </div>
      )}
      {/* Photo de profil */}
      <div className="relative h-48 bg-gradient-to-br from-primary-100 to-primary-200">
        {coach.profilePicture ? (
          <img
            src={getMediaUrl(coach.profilePicture) || undefined}
            alt={`${coach.user.firstName} ${coach.user.lastName}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="h-20 w-20 text-primary-400" />
          </div>
        )}
      </div>

      {/* Informations du coach */}
      <div className="p-4 space-y-3">
        {/* Nom et rating */}
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            {coach.user.firstName} {coach.user.lastName}
          </h3>
          {coach.rating > 0 && (
            <div className="flex items-center mt-1">
              <span className="text-yellow-500 mr-1">&#9733;</span>
              <span className="text-sm text-gray-600">
                {coach.rating.toFixed(1)} ({coach.ratingCount} avis)
              </span>
            </div>
          )}
        </div>

        {/* Bio */}
        {coach.bio && (
          <p className="text-sm text-gray-600 line-clamp-2">{coach.bio}</p>
        )}

        {/* Localisation et type */}
        <div className="flex flex-wrap gap-2 text-sm">
          {coach.city && (
            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded">
              <MapPin className="h-3 w-3 mr-1" />
              {coach.city}
            </span>
          )}
          {coach.trainingLocations?.slice(0, 2).map((loc) => (
            <span key={loc} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded">
              <Dumbbell className="h-3 w-3 mr-1" />
              {loc}
            </span>
          ))}
          {coach.isRemote && (
            <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded">
              <Wifi className="h-3 w-3 mr-1" />
              À distance
            </span>
          )}
        </div>

        {/* Preview des posts */}
        {previewPosts.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Derniers posts</p>
            <div className="grid grid-cols-3 gap-2">
              {previewPosts.map((post, index) => (
                <div
                  key={post.id || index}
                  className="relative h-20 bg-gray-200 rounded overflow-hidden"
                >
                  {post.mediaUrl && (
                    <>
                      {post.mediaType === 'image' ? (
                        <img
                          src={getMediaUrl(post.mediaUrl) || undefined}
                          alt="Post preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={getMediaUrl(post.mediaUrl) || undefined}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bouton */}
        <Button className="w-full" variant="primary">
          Voir le profil
        </Button>
      </div>
    </Card>
  );
}
