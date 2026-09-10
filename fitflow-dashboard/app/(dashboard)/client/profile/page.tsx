'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Edit, MapPin, Dumbbell, Star } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { clientsAPI, clientCoachesAPI, availabilityAPI } from '@/lib/api';
import { GYM_CHAINS, OUTDOOR_LOCATIONS, OTHER_LOCATIONS } from '@/lib/locations';
import type { ClientAvailability, ContactType } from '@/types';
import PhotoCropper from '@/components/profile/PhotoCropper';
import { getMediaUrl } from '@/lib/media';


// Niveaux disponibles
const LEVELS = [
  { value: 'debutant', label: 'Débutant' },
  { value: 'intermediaire', label: 'Intermédiaire' },
  { value: 'avance', label: 'Avancé' },
];

// Genres disponibles
const GENDERS = [
  { value: 'M', label: 'Homme' },
  { value: 'F', label: 'Femme' },
  { value: 'X', label: 'Autre' },
];

interface CoachRelation {
  id: string;
  coachId: string;
  isPrimary: boolean;
  isActive: boolean;
  coach: {
    id: string;
    bio?: string;
    user: { firstName: string; lastName: string; email: string };
  };
}

interface Profile {
  profilePicture?: string;
  goals?: string;
  level?: string;
  weight?: number;
  height?: number;
  gender?: string;
  city?: string;
  trainingLocations?: string[];
  coach?: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
  coaches?: CoachRelation[];
}

interface AuthUser {
  firstName: string;
  lastName: string;
  email: string;
}

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const CONTACT_LABELS: Record<string, string> = {
  PHONE: 'Téléphone', GYM: 'Salle', CAFE: 'Café', VISIO: 'Visio',
};

export default function ClientProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [availabilities, setAvailabilities] = useState<ClientAvailability[]>([]);
  const [editingAvailability, setEditingAvailability] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const res = await availabilityAPI.getMyAvailability();
      setAvailabilities(res.data.data || []);
    } catch {
      // silencieux
    }
  };

  const fetchProfile = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiUrl}/clients/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Mon Profil</h1>
        </div>

        {/* Carte Profil */}
        <Card>
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Informations personnelles</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingProfile(true)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Photo de profil */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200">
                {profile?.profilePicture ? (
                  <img
                    src={getMediaUrl(profile.profilePicture) || undefined}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-16 w-16 text-primary-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Informations */}
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-1">
                  {(user as AuthUser)?.firstName} {(user as AuthUser)?.lastName}
                </h3>
                <p className="text-gray-600">{(user as AuthUser)?.email}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Objectif</span>
                  <p className="text-gray-900">{profile?.goals || 'Non renseigné'}</p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Niveau</span>
                  <p className="text-gray-900">
                    {LEVELS.find(l => l.value === profile?.level)?.label || 'Non renseigné'}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Poids</span>
                  <p className="text-gray-900">{profile?.weight ? `${profile.weight} kg` : 'Non renseigné'}</p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Taille</span>
                  <p className="text-gray-900">{profile?.height ? `${profile.height} cm` : 'Non renseigné'}</p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Genre</span>
                  <p className="text-gray-900">
                    {GENDERS.find(g => g.value === profile?.gender)?.label || 'Non renseigné'}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Ville</span>
                  <p className="text-gray-900 flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    {profile?.city || 'Non renseignée'}
                  </p>
                </div>

              </div>
            </div>

            {profile?.trainingLocations && profile.trainingLocations.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-500">Lieux d&apos;entraînement</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.trainingLocations.map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      <Dumbbell className="h-3 w-3 mr-1" />
                      {loc}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
        {/* Section Mes Disponibilités */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Mes Disponibilités</h2>
            <Button variant="outline" size="sm" onClick={() => setEditingAvailability(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          </div>
          {availabilities.length === 0 ? (
            <p className="text-gray-500 text-sm">Vous n&apos;avez pas encore renseigné vos disponibilités.</p>
          ) : (
            <div className="space-y-2">
              {availabilities.map((slot) => (
                <div key={slot.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                  <span className="w-24 font-medium text-gray-700">{DAYS_FR[slot.dayOfWeek]}</span>
                  <span className="text-gray-600">{slot.startTime} – {slot.endTime}</span>
                  <div className="flex gap-1 flex-wrap">
                    {slot.contactTypes.map((ct) => (
                      <span key={ct} className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                        {CONTACT_LABELS[ct] || ct}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section Mes Coachs */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Mes Coachs</h2>
          {profile?.coaches && profile.coaches.length > 0 ? (
            <div className="space-y-3">
              {profile.coaches.map((relation) => (
                <CoachRelationRow
                  key={relation.id}
                  relation={relation}
                  onRefresh={fetchProfile}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              Vous n&apos;avez pas encore de coach. Rendez-vous dans{' '}
              <a href="/client/coaches" className="text-primary-600 hover:underline">Trouver un Coach</a>.
            </p>
          )}
        </Card>
      </div>

      {/* Edit Profile Modal */}
      {editingProfile && (
        <ProfileEditModal
          profile={profile}
          user={user as AuthUser}
          onClose={() => setEditingProfile(false)}
          onSuccess={() => {
            setEditingProfile(false);
            fetchProfile();
          }}
        />
      )}

      {/* Edit Availability Modal */}
      {editingAvailability && (
        <AvailabilityEditModal
          availabilities={availabilities}
          onClose={() => setEditingAvailability(false)}
          onSuccess={() => {
            setEditingAvailability(false);
            fetchAvailability();
          }}
        />
      )}
    </>
  );
}

// Ligne de relation coach-client avec actions
function CoachRelationRow({ relation, onRefresh }: { relation: CoachRelation; onRefresh: () => void }) {
  const [loading, setLoading] = React.useState(false);

  const handleSetPrimary = async () => {
    setLoading(true);
    try {
      await clientCoachesAPI.setPrimary(relation.id);
      onRefresh();
    } catch (error) {
      console.error('Erreur setPrimary:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Retirer ${relation.coach.user.firstName} ${relation.coach.user.lastName} de vos coaches ?`)) return;
    setLoading(true);
    try {
      await clientCoachesAPI.remove(relation.id);
      onRefresh();
    } catch (error) {
      console.error('Erreur remove:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
          <User className="h-5 w-5 text-primary-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {relation.coach.user.firstName} {relation.coach.user.lastName}
            </span>
            {relation.isPrimary && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                <Star className="h-3 w-3" />
                Principal
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{relation.coach.user.email}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!relation.isPrimary && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSetPrimary}
            disabled={loading}
          >
            Définir comme principal
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRemove}
          disabled={loading}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          Retirer
        </Button>
      </div>
    </div>
  );
}

// Availability Edit Modal Component
const CONTACT_TYPES: ContactType[] = ['PHONE', 'GYM', 'CAFE', 'VISIO'];
const CONTACT_LABELS_MODAL: Record<ContactType, string> = {
  PHONE: 'Téléphone', GYM: 'Salle', CAFE: 'Café', VISIO: 'Visio',
};
const WEEK_DAYS = [
  { dow: 1, label: 'Lundi' },
  { dow: 2, label: 'Mardi' },
  { dow: 3, label: 'Mercredi' },
  { dow: 4, label: 'Jeudi' },
  { dow: 5, label: 'Vendredi' },
  { dow: 6, label: 'Samedi' },
  { dow: 0, label: 'Dimanche' },
];

type DaySlot = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  contactTypes: ContactType[];
};

function AvailabilityEditModal({ availabilities, onClose, onSuccess }: {
  availabilities: ClientAvailability[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const initialSlots = (): Record<number, DaySlot> => {
    const map: Record<number, DaySlot> = {};
    WEEK_DAYS.forEach(({ dow }) => {
      const existing = availabilities.find((a) => a.dayOfWeek === dow);
      map[dow] = existing
        ? { enabled: true, startTime: existing.startTime, endTime: existing.endTime, contactTypes: existing.contactTypes as ContactType[] }
        : { enabled: false, startTime: '09:00', endTime: '18:00', contactTypes: [] };
    });
    return map;
  };

  const [slots, setSlots] = useState<Record<number, DaySlot>>(initialSlots);
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (dow: number) => {
    setSlots((prev) => ({ ...prev, [dow]: { ...prev[dow], enabled: !prev[dow].enabled } }));
  };

  const updateSlot = (dow: number, field: keyof DaySlot, value: unknown) => {
    setSlots((prev) => ({ ...prev, [dow]: { ...prev[dow], [field]: value } }));
  };

  const toggleContact = (dow: number, ct: ContactType) => {
    setSlots((prev) => {
      const current = prev[dow].contactTypes;
      const updated = current.includes(ct) ? current.filter((c) => c !== ct) : [...current, ct];
      return { ...prev, [dow]: { ...prev[dow], contactTypes: updated } };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const toSave = WEEK_DAYS
        .filter(({ dow }) => slots[dow].enabled)
        .map(({ dow }) => ({
          dayOfWeek: dow,
          startTime: slots[dow].startTime,
          endTime: slots[dow].endTime,
          contactTypes: slots[dow].contactTypes,
        }));
      await availabilityAPI.setMyAvailability(toSave);
      onSuccess();
    } catch {
      alert('Erreur lors de la sauvegarde des disponibilités');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Mes Disponibilités</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {WEEK_DAYS.map(({ dow, label }) => (
              <div key={dow} className="border rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={slots[dow].enabled}
                    onChange={() => toggleDay(dow)}
                    className="h-4 w-4 text-primary-600 rounded"
                  />
                  <span className="font-semibold text-gray-900">{label}</span>
                </label>
                {slots[dow].enabled && (
                  <div className="space-y-3 ml-7">
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={slots[dow].startTime}
                        onChange={(e) => updateSlot(dow, 'startTime', e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="time"
                        value={slots[dow].endTime}
                        onChange={(e) => updateSlot(dow, 'endTime', e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {CONTACT_TYPES.map((ct) => (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => toggleContact(dow, ct)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            slots[dow].contactTypes.includes(ct)
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {CONTACT_LABELS_MODAL[ct]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Profile Edit Modal Component
function ProfileEditModal({ profile, user, onClose, onSuccess }: {
  profile: Profile | null;
  user: AuthUser;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    goals: '',
    level: '',
    weight: '',
    height: '',
    gender: '',
    city: '',
  });
  const [trainingLocations, setTrainingLocations] = useState<string[]>([]);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  /** Fichier en attente de recadrage ; non nul = modale ouverte. */
  const [toCrop, setToCrop] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        goals: profile.goals || '',
        level: profile.level || '',
        weight: profile.weight?.toString() || '',
        height: profile.height?.toString() || '',
        gender: profile.gender || '',
        city: profile.city || '',
      });
      setTrainingLocations(profile.trainingLocations || []);
      if (profile.profilePicture) {
        setPicturePreview(getMediaUrl(profile.profilePicture));
      }
    }
  }, []);

  const toggleLocation = (location: string) => {
    setTrainingLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  const LocationGroup = ({ title, locations }: { title: string; locations: string[] }) => (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        {locations.map((loc) => (
          <label key={loc} className="flex items-center p-2 border rounded hover:bg-gray-50 cursor-pointer gap-2">
            <input
              type="checkbox"
              checked={trainingLocations.includes(loc)}
              onChange={() => toggleLocation(loc)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">{loc}</span>
          </label>
        ))}
      </div>
    </div>
  );

  /**
   * Ouvre le recadrage au lieu d'accepter le fichier tel quel : la photo s'affiche
   * en cercle, un portrait en pied y devenait illisible.
   */
  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image');
      return;
    }

    setToCrop(file);
    // Input vidé : sans ça, resélectionner le même fichier après une annulation ne
    // déclenche aucun événement change.
    e.target.value = '';
  };

  const handleCropped = (cropped: File, previewUrl: string) => {
    setProfilePictureFile(cropped);
    setPicturePreview(previewUrl);
    setToCrop(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const dataToSend: Record<string, unknown> = { ...formData, trainingLocations };
      if (profilePictureFile) {
        dataToSend.profilePicture = profilePictureFile;
      }

      await clientsAPI.updateMyProfile(dataToSend);
      onSuccess();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Erreur lors de la mise à jour du profil');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Modifier mon profil</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo de profil */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Photo de profil
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200">
                  {picturePreview ? (
                    <img
                      src={picturePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="h-12 w-12 text-primary-400" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="cursor-pointer">
                    <span className="px-4 py-2 bg-primary-100 hover:bg-primary-200 text-primary-600 font-medium rounded-lg inline-block transition-colors">
                      Changer la photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePictureChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Objectif */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Objectif
              </label>
              <textarea
                value={formData.goals}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, goals: e.target.value }))
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Décrivez vos objectifs fitness..."
              />
            </div>

            {/* Niveau */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Niveau
              </label>
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, level: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Sélectionnez un niveau</option>
                {LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Poids et Taille */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poids (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, weight: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="70"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Taille (cm)
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.height}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, height: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="175"
                />
              </div>
            </div>

            {/* Genre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Genre
              </label>
              <select
                value={formData.gender}
                onChange={(e) =>
                  setFormData(prev => ({ ...prev, gender: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Sélectionnez un genre</option>
                {GENDERS.map((gender) => (
                  <option key={gender.value} value={gender.value}>
                    {gender.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Ville */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ville
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Paris, Lyon, Marseille..."
              />
            </div>

            {/* Lieux d'entraînement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Lieux d&apos;entraînement
              </label>
              <div className="space-y-4">
                <LocationGroup title="Chaînes de salles" locations={GYM_CHAINS} />
                <LocationGroup title="Lieux extérieurs" locations={OUTDOOR_LOCATIONS} />
                <LocationGroup title="Autres" locations={OTHER_LOCATIONS} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Recadrage de la photo de profil */}
      {toCrop && (
        <PhotoCropper
          key={`${toCrop.name}-${toCrop.size}-${toCrop.lastModified}`}
          file={toCrop}
          onCancel={() => setToCrop(null)}
          onDone={handleCropped}
        />
      )}
    </div>
  );
}
