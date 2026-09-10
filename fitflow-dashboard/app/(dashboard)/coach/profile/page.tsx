'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { coachesAPI, availabilityAPI } from '@/lib/api';
import {
  Plus,
  Edit,
  User,
  MapPin,
  Wifi,
  Dumbbell,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/auth-context';
import type { CoachProfile as CoachProfileType, CoachScheduleBlock } from '@/types';
import { GYM_CHAINS, OUTDOOR_LOCATIONS, OTHER_LOCATIONS } from '@/lib/locations';
import PhotoCropper from '@/components/profile/PhotoCropper';
import { getMediaUrl } from '@/lib/media';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];


// ─── Profile Edit Modal ───────────────────────────────────────────────────────

interface ProfileEditModalProps {
  profile: CoachProfileType | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ProfileEditModal({ profile, onClose, onSuccess }: ProfileEditModalProps) {
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [isRemote, setIsRemote] = useState(profile?.isRemote ?? false);
  const [trainingLocations, setTrainingLocations] = useState<string[]>(
    profile?.trainingLocations ?? []
  );
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  /** Fichier en attente de recadrage ; non nul = modale ouverte. */
  const [toCrop, setToCrop] = useState<File | null>(null);
  const [picturePreview, setPicturePreview] = useState<string | null>(
    profile?.profilePicture ? getMediaUrl(profile.profilePicture) : null
  );
  const [submitting, setSubmitting] = useState(false);

  const toggleLocation = (location: string) => {
    setTrainingLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  /**
   * Ouvre le recadrage au lieu d'accepter le fichier tel quel.
   *
   * Les photos s'affichent en cercle : sans recadrage, un portrait en pied donnait
   * une vignette où le visage faisait quelques pixels.
   */
  const handlePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setToCrop(file);
    // On vide l'input : sans ça, resélectionner le MÊME fichier après une annulation
    // ne déclenche pas d'événement change, et rien ne se passe.
    e.target.value = '';
  };

  const handleCropped = (cropped: File, previewUrl: string) => {
    setPictureFile(cropped);
    setPicturePreview(previewUrl);
    setToCrop(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: Record<string, unknown> = { bio, city, isRemote, trainingLocations };
      if (pictureFile) data.profilePicture = pictureFile;
      await coachesAPI.updateMyProfile(data);
      onSuccess();
    } catch {
      alert('Erreur lors de la mise à jour du profil');
    } finally {
      setSubmitting(false);
    }
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Modifier mon profil</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                  {picturePreview ? (
                    <img src={picturePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="h-12 w-12 text-primary-400" />
                  )}
                </div>
                <label className="cursor-pointer px-4 py-2 bg-primary-100 hover:bg-primary-200 text-primary-600 font-medium rounded-lg transition-colors">
                  Changer la photo
                  <input type="file" accept="image/*" onChange={handlePictureChange} className="hidden" />
                </label>
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Biographie</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Présentez-vous et décrivez votre approche..."
              />
            </div>

            {/* Ville */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Paris, Lyon, Marseille..."
              />
            </div>

            {/* Lieux */}
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

            {/* Remote */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRemote"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="isRemote" className="text-sm text-gray-900">
                Je propose du coaching à distance
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
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

      {/* Recadrage : monté DANS la modale d'édition, qui porte l'état `toCrop`. */}
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CoachProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [scheduleBlocks, setScheduleBlocks] = useState<CoachScheduleBlock[]>([]);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlock, setNewBlock] = useState({ type: 'recurring' as 'recurring' | 'oneshot', dayOfWeek: 1, date: '', reason: '' });
  const [addingBlock, setAddingBlock] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await coachesAPI.getMyProfile();
      setProfile(res.data.data);
    } catch {
      console.error('Error fetching profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduleBlocks = async () => {
    try {
      const res = await availabilityAPI.getMyScheduleBlocks();
      setScheduleBlocks(res.data.data || []);
    } catch {
      // silencieux
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingBlock(true);
    try {
      await availabilityAPI.addScheduleBlock({
        dayOfWeek: newBlock.type === 'recurring' ? newBlock.dayOfWeek : undefined,
        date: newBlock.type === 'oneshot' ? newBlock.date : undefined,
        reason: newBlock.reason || undefined,
      });
      setShowAddBlock(false);
      setNewBlock({ type: 'recurring', dayOfWeek: 1, date: '', reason: '' });
      fetchScheduleBlocks();
    } catch {
      alert('Erreur lors de l\'ajout du blocage');
    } finally {
      setAddingBlock(false);
    }
  };

  const handleRemoveBlock = async (blockId: string) => {
    try {
      await availabilityAPI.removeScheduleBlock(blockId);
      fetchScheduleBlocks();
    } catch {
      alert('Erreur lors de la suppression du blocage');
    }
  };

  useEffect(() => {
    fetchScheduleBlocks();
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mon Profil</h1>
        <p className="text-gray-600 mt-1">Gérez votre profil public</p>
      </div>

      {/* Profile info */}
      <Card>
        <div className="flex items-start justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Informations du profil</h2>
          <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
            {profile?.profilePicture ? (
              <Image
                src={getMediaUrl(profile.profilePicture)!}
                alt="Profile"
                width={128}
                height={128}
                className="object-cover w-full h-full"
              />
            ) : (
              <User className="h-16 w-16 text-primary-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {user?.firstName} {user?.lastName}
            </h3>
            <p className="text-gray-600 mb-4">
              {profile?.bio || 'Ajoutez une description pour que les clients vous connaissent mieux.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                <MapPin className="h-4 w-4 mr-1" />
                {profile?.city || 'Ville non renseignée'}
              </span>
              {profile?.trainingLocations?.map((loc) => (
                <span key={loc} className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  <Dumbbell className="h-4 w-4 mr-1" />
                  {loc}
                </span>
              ))}
              {profile?.isRemote && (
                <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  <Wifi className="h-4 w-4 mr-1" />
                  Coaching à distance
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Section Jours Bloqués */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Mes Jours Bloqués</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAddBlock(!showAddBlock)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>

        {showAddBlock && (
          <form onSubmit={handleAddBlock} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="recurring" checked={newBlock.type === 'recurring'}
                  onChange={() => setNewBlock(p => ({ ...p, type: 'recurring' }))} />
                <span className="text-sm">Récurrent (jour de la semaine)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value="oneshot" checked={newBlock.type === 'oneshot'}
                  onChange={() => setNewBlock(p => ({ ...p, type: 'oneshot' }))} />
                <span className="text-sm">Ponctuel (date précise)</span>
              </label>
            </div>
            {newBlock.type === 'recurring' ? (
              <select value={newBlock.dayOfWeek}
                onChange={(e) => setNewBlock(p => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {DAYS_FR.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            ) : (
              <input type="date" required value={newBlock.date}
                onChange={(e) => setNewBlock(p => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            )}
            <input type="text" value={newBlock.reason} placeholder="Raison (optionnel)"
              onChange={(e) => setNewBlock(p => ({ ...p, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAddBlock(false)}>Annuler</Button>
              <Button type="submit" size="sm" disabled={addingBlock}>
                {addingBlock ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>
          </form>
        )}

        {scheduleBlocks.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun jour bloqué pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {scheduleBlocks.map((block) => (
              <div key={block.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <span className="font-medium text-gray-900">
                    {block.dayOfWeek !== undefined && block.dayOfWeek !== null
                      ? `Tous les ${DAYS_FR[block.dayOfWeek]}`
                      : block.date ? format(parseISO(block.date), 'dd MMMM yyyy', { locale: fr }) : ''}
                  </span>
                  {block.reason && <span className="ml-2 text-sm text-gray-500">— {block.reason}</span>}
                </div>
                <button onClick={() => handleRemoveBlock(block.id)} className="text-red-500 hover:text-red-700 p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editingProfile && (
        <ProfileEditModal
          profile={profile}
          onClose={() => setEditingProfile(false)}
          onSuccess={() => { setEditingProfile(false); fetchProfile(); }}
        />
      )}
    </div>
  );
}
