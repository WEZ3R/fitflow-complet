'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { coachesAPI } from '@/lib/api';
import { MapPin, Wifi, Dumbbell, User, Star, Send, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/auth-context';
import { getMediaUrl } from '@/lib/media';
import { ReportDialog } from '@/components/moderation/report-dialog';


interface CoachUser {
  id: string;
  firstName: string;
  lastName: string;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  client: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

interface CoachProfile {
  id: string;
  bio?: string;
  city?: string;
  gym?: string;
  isRemote?: boolean;
  rating: number;
  ratingCount: number;
  profilePicture?: string;
  user: CoachUser;
  reviews?: Review[];
}

interface ClientProfileData {
  coaches?: Array<{ coach?: { id: string }; coachId?: string }>;
}

interface ExistingRequest {
  status: string;
}

export default function PublicCoachProfilePage({ params }: { params: Promise<{ coachId: string }> }) {
  const { coachId } = React.use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [existingRequest, setExistingRequest] = useState<ExistingRequest | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfileData | null>(null);

  useEffect(() => {
    fetchCoachProfile();
    fetchClientProfile();
    checkExistingRequest();
  }, [coachId]);

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

  const fetchCoachProfile = async () => {
    try {
      const response = await coachesAPI.getById(coachId);
      setCoach(response.data.data);
    } catch (error) {
      console.error('Error fetching coach profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingRequest = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiUrl}/requests/sent`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        const request = data.data.find((req: { coachId: string }) => req.coachId === coachId);
        setExistingRequest(request);
      }
    } catch (error) {
      console.error('Error checking existing request:', error);
    }
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestMessage.trim()) {
      alert('Veuillez écrire un message');
      return;
    }

    setSendingRequest(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
      const response = await fetch(`${apiUrl}/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coachId,
          message: requestMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowRequestModal(false);
        setRequestMessage('');
        setExistingRequest(data.data);
        alert('Demande envoyée avec succès!');
      } else {
        alert(data.message || 'Erreur lors de l\'envoi de la demande');
      }
    } catch (error) {
      console.error('Error sending request:', error);
      alert('Erreur lors de l\'envoi de la demande');
    } finally {
      setSendingRequest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Chargement...</p>
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="text-center py-12">
        <User className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600">Coach non trouvé</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header avec photo de profil et infos principales */}
        <Card>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Photo de profil */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200">
                {coach.profilePicture ? (
                  <img
                    src={getMediaUrl(coach.profilePicture) || undefined}
                    alt={`${coach.user.firstName} ${coach.user.lastName}`}
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
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {coach.user.firstName} {coach.user.lastName}
                </h1>
                <ReportDialog
                  reportedUserId={coach.user.id}
                  reportedName={`${coach.user.firstName} ${coach.user.lastName}`}
                  context="PROFILE"
                />
              </div>

              {/* Rating */}
              {coach.rating > 0 && (
                <div className="flex items-center mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.round(coach.rating)
                          ? 'text-yellow-500 fill-yellow-500'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-gray-600">
                    {coach.rating.toFixed(1)} ({coach.ratingCount} avis)
                  </span>
                </div>
              )}

              {/* Bio */}
              {coach.bio && (
                <p className="text-gray-700 mb-4">{coach.bio}</p>
              )}

              {/* Localisation et type */}
              <div className="flex flex-wrap gap-2 mb-4">
                {coach.city && (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                    <MapPin className="h-4 w-4 mr-1" />
                    {coach.city}
                  </span>
                )}
                {coach.gym && (
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                    <Dumbbell className="h-4 w-4 mr-1" />
                    {coach.gym}
                  </span>
                )}
                {coach.isRemote && (
                  <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    <Wifi className="h-4 w-4 mr-1" />
                    Coaching à distance
                  </span>
                )}
              </div>

              {/* Boutons d'action */}
              <div className="space-y-3">
                {/* Bouton message - toujours disponible */}
                <Button
                  className="w-full flex items-center justify-center"
                  onClick={() => router.push(`/client/messages?coachId=${coachId}`)}
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Envoyer un message
                </Button>

                {/* Status de la relation avec le coach */}
                {clientProfile?.coaches?.some(c => c.coach?.id === coachId || c.coachId === coachId) ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-green-900">
                      &#10003; Ce coach fait partie de vos coaches
                    </p>
                  </div>
                ) : existingRequest ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900">
                      {existingRequest.status === 'pending' && 'Demande envoyée - En attente de réponse'}
                      {existingRequest.status === 'accepted' && 'Demande acceptée!'}
                      {existingRequest.status === 'rejected' && 'Demande refusée'}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center"
                    onClick={() => setShowRequestModal(true)}
                  >
                    <Send className="h-5 w-5 mr-2" />
                    Demander un coaching
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Section Avis */}
        {coach.reviews && coach.reviews.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Avis des clients ({coach.reviews.length})
            </h2>
            <div className="space-y-4">
              {coach.reviews.map((review) => (
                <Card key={review.id}>
                  <div className="flex items-start space-x-4">
                    {/* Avatar du client */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-600" />
                    </div>

                    {/* Contenu de l'avis */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {review.client.user.firstName}{' '}
                            {review.client.user.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(review.createdAt), 'dd MMMM yyyy', {
                              locale: fr,
                            })}
                          </p>
                        </div>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating
                                  ? 'text-yellow-500 fill-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-gray-700">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Message si pas d'avis */}
        {(!coach.reviews || coach.reviews.length === 0) && (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600">
                Ce coach n&apos;a pas encore d&apos;avis
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Modal de demande */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">
              Demander un coaching
            </h2>
            <p className="text-gray-600 mb-4">
              Envoyez un message à {coach.user.firstName} {coach.user.lastName} pour
              lui demander de devenir votre coach.
            </p>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Votre message
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Bonjour, je souhaiterais être coaché par vous car..."
                  required
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestMessage('');
                  }}
                  disabled={sendingRequest}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={sendingRequest}
                >
                  {sendingRequest ? 'Envoi...' : 'Envoyer la demande'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
