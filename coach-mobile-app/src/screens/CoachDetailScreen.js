import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coachesAPI, clientsAPI, requestsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../../config';
import { couleurs } from '../theme';

const CoachDetailScreen = ({ route, navigation }) => {
  const { coachId } = route.params;
  const { user } = useAuth();
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [clientProfile, setClientProfile] = useState(null);

  // Avis
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchData();
  }, [coachId]);

  const fetchData = async () => {
    try {
      const [coachRes, clientRes, requestsRes] = await Promise.all([
        coachesAPI.getById(coachId),
        clientsAPI.getMe(),
        requestsAPI.getSent(),
      ]);

      if (coachRes.data.success) setCoach(coachRes.data.data);
      if (clientRes.data.success) setClientProfile(clientRes.data.data);
      if (requestsRes.data.success) {
        const req = (requestsRes.data?.data || []).find((r) => r.coachId === coachId);
        setExistingRequest(req);
      }
    } catch (error) {
      console.error('Error fetching coach details:', error);
      Alert.alert('Erreur', 'Impossible de charger les informations du coach');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!requestMessage.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un message');
      return;
    }

    setSendingRequest(true);
    try {
      const response = await requestsAPI.send({ coachId, message: requestMessage });
      if (response.data.success) {
        setShowRequestModal(false);
        setRequestMessage('');
        setExistingRequest(response.data.data);
        Alert.alert('Succès', 'Demande envoyée avec succès !');
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || "Erreur lors de l'envoi");
    } finally {
      setSendingRequest(false);
    }
  };

  // Avis : ouvrir la modale pré-remplie si un avis existe déjà
  const openReviewModal = () => {
    const myReview = coach?.reviews?.find(r => r.clientId === clientProfile?.id);
    setReviewRating(myReview?.rating || 0);
    setReviewComment(myReview?.comment || '');
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Note requise', 'Veuillez sélectionner une note entre 1 et 5 étoiles.');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await coachesAPI.upsertReview(coachId, { rating: reviewRating, comment: reviewComment });
      if (res.data.success) {
        setShowReviewModal(false);
        // Rafraîchir les données du coach
        const coachRes = await coachesAPI.getById(coachId);
        if (coachRes.data.success) setCoach(coachRes.data.data);
        Alert.alert('Merci !', 'Votre avis a bien été enregistré.');
      }
    } catch (error) {
      Alert.alert('Erreur', error.response?.data?.message || "Erreur lors de l'envoi de l'avis");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = () => {
    Alert.alert(
      'Supprimer mon avis',
      'Êtes-vous sûr de vouloir supprimer votre avis ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await coachesAPI.deleteReview(coachId);
              const coachRes = await coachesAPI.getById(coachId);
              if (coachRes.data.success) setCoach(coachRes.data.data);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer l\'avis');
            }
          },
        },
      ]
    );
  };

  const getMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${API_URL.replace('/api', '')}${url}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  if (!coach) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Coach non trouvé</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderActionButton = () => {
    // Cherche si ce coach est déjà dans la liste des coaches M2M du client
    const existingRelation = clientProfile?.coaches?.find(c => c.coachId === coachId);

    if (existingRelation) {
      return (
        <View style={styles.currentCoachContainer}>
          <Text style={styles.currentCoachTitle}>
            {existingRelation.isPrimary
              ? "C'est votre coach principal !"
              : `Vous êtes coaché par ${coach.user.firstName} !`}
          </Text>
          <TouchableOpacity
            style={styles.messageButton}
            onPress={() => navigation.navigate('Main', { screen: 'Messages' })}
          >
            <Ionicons name="chatbubble-outline" size={20} color={couleurs.texteInverse} />
            <Text style={styles.messageButtonText}>Envoyer un message</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (existingRequest) {
      return (
        <View style={styles.requestStatusContainer}>
          <Text style={styles.requestStatusTitle}>
            {existingRequest.status === 'pending' && 'Demande envoyée - En attente de réponse'}
            {existingRequest.status === 'accepted' && 'Demande acceptée !'}
            {existingRequest.status === 'rejected' && 'Demande refusée'}
          </Text>
          {existingRequest.status === 'pending' && existingRequest.message && (
            <Text style={styles.requestMessageText}>
              Votre message : "{existingRequest.message}"
            </Text>
          )}
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.requestButton} onPress={() => setShowRequestModal(true)}>
        <Ionicons name="send-outline" size={20} color={couleurs.texteInverse} />
        <Text style={styles.requestButtonText}>Demander un coaching</Text>
      </TouchableOpacity>
    );
  };

  const reviews = coach.reviews || [];

  // Le client est-il un client actif de ce coach ?
  const isLinkedClient = user?.role === 'CLIENT' &&
    clientProfile?.coaches?.some(c => c.coachId === coachId && c.isActive);
  // A-t-il déjà laissé un avis ?
  const myReview = reviews.find(r => r.clientId === clientProfile?.id);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backIconButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={couleurs.texteInverse} />
          </TouchableOpacity>
        </View>

        {/* Photo */}
        <View style={styles.profileImageContainer}>
          {coach.profilePicture ? (
            <Image source={{ uri: getMediaUrl(coach.profilePicture) }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Ionicons name="person" size={60} color={couleurs.texteFaible} />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.coachName}>
            {coach.user.firstName} {coach.user.lastName}
          </Text>

          {coach.rating > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={20} color={couleurs.alerte} />
              <Text style={styles.ratingText}>
                {coach.rating.toFixed(1)} ({coach.ratingCount} avis)
              </Text>
            </View>
          )}

          {isLinkedClient && (
            <TouchableOpacity style={styles.addReviewButton} onPress={openReviewModal}>
              <Ionicons name={myReview ? 'create-outline' : 'star-outline'} size={16} color={couleurs.accent} />
              <Text style={styles.addReviewButtonText}>
                {myReview ? 'Modifier mon avis' : 'Laisser un avis'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Bio */}
          {coach.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>À propos</Text>
              <Text style={styles.bioText}>{coach.bio}</Text>
            </View>
          )}

          {/* Expérience */}
          {coach.experience && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Expérience</Text>
              <Text style={styles.bioText}>{coach.experience}</Text>
            </View>
          )}

          {/* Informations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations</Text>
            <View style={styles.infoRow}>
              {coach.city && (
                <View style={styles.infoItem}>
                  <Ionicons name="location" size={18} color={couleurs.accent} />
                  <Text style={styles.infoItemText}>{coach.city}</Text>
                </View>
              )}
              {coach.trainingLocations?.[0] && (
                <View style={styles.infoItem}>
                  <Ionicons name="barbell" size={18} color={couleurs.accent} />
                  <Text style={styles.infoItemText}>{coach.trainingLocations[0]}</Text>
                </View>
              )}
              {coach.isRemote && (
                <View style={styles.infoItem}>
                  <Ionicons name="wifi" size={18} color={couleurs.accent} />
                  <Text style={styles.infoItemText}>Coaching à distance</Text>
                </View>
              )}
            </View>
          </View>

          {/* Avis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Avis{reviews.length > 0 ? ` (${reviews.length})` : ''}
            </Text>

            {reviews.length === 0 && (
              <Text style={styles.noReviewsText}>Aucun avis pour le moment.</Text>
            )}

            {reviews.map((review) => {
              const isMyReview = review.clientId === clientProfile?.id;
              return (
                <View key={review.id} style={[styles.reviewCard, isMyReview && styles.myReviewCard]}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>
                        {review.client?.user?.firstName?.[0] || '?'}
                      </Text>
                    </View>
                    <View style={styles.reviewInfo}>
                      <Text style={styles.reviewName}>
                        {isMyReview ? 'Mon avis' : `${review.client?.user?.firstName} ${review.client?.user?.lastName}`}
                      </Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Ionicons
                            key={star}
                            name={star <= review.rating ? 'star' : 'star-outline'}
                            size={14}
                            color={couleurs.alerte}
                          />
                        ))}
                      </View>
                    </View>
                    <View style={styles.reviewDateActions}>
                      <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
                      {isMyReview && (
                        <TouchableOpacity onPress={handleDeleteReview} style={styles.deleteReviewBtn}>
                          <Ionicons name="trash-outline" size={14} color={couleurs.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {review.comment && (
                    <Text style={styles.reviewComment}>{review.comment}</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Action */}
          <View style={styles.actionSection}>
            {renderActionButton()}
          </View>
        </View>
      </ScrollView>

      {/* Modal avis */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => { Keyboard.dismiss(); setShowReviewModal(false); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {myReview ? 'Modifier mon avis' : 'Laisser un avis'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Comment évaluez-vous {coach.user.firstName} {coach.user.lastName} ?
            </Text>

            {/* Sélecteur d'étoiles */}
            <View style={styles.starPicker}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                  <Ionicons
                    name={star <= reviewRating ? 'star' : 'star-outline'}
                    size={40}
                    color={couleurs.alerte}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {reviewRating > 0 && (
              <Text style={styles.ratingLabel}>
                {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent !'][reviewRating]}
              </Text>
            )}

            <TextInput
              style={styles.messageInput}
              placeholder="Partagez votre expérience (optionnel)"
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowReviewModal(false)}
                disabled={submittingReview}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color={couleurs.texteInverse} />
                ) : (
                  <Text style={styles.modalButtonSubmitText}>
                    {myReview ? 'Mettre à jour' : 'Envoyer'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal de demande */}
      <Modal
        visible={showRequestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Demander un coaching</Text>
            <Text style={styles.modalSubtitle}>
              Envoyez un message à {coach.user.firstName} {coach.user.lastName} pour lui demander de devenir votre coach.
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder="Bonjour, je souhaiterais être coaché par vous car..."
              value={requestMessage}
              onChangeText={setRequestMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => { setShowRequestModal(false); setRequestMessage(''); }}
                disabled={sendingRequest}
              >
                <Text style={styles.modalButtonCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit]}
                onPress={handleSendRequest}
                disabled={sendingRequest}
              >
                {sendingRequest ? (
                  <ActivityIndicator color={couleurs.texteInverse} />
                ) : (
                  <Text style={styles.modalButtonSubmitText}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: couleurs.carte },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 200, backgroundColor: couleurs.accent,
    justifyContent: 'flex-start', paddingTop: 60, paddingHorizontal: 20,
  },
  backIconButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  profileImageContainer: { alignItems: 'center', marginTop: -60 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: couleurs.carte },
  profileImagePlaceholder: {
    width: 120, height: 120, borderRadius: 60, backgroundColor: couleurs.accentVoile,
    borderWidth: 4, borderColor: couleurs.carte, justifyContent: 'center', alignItems: 'center',
  },
  content: { padding: 20 },
  coachName: { fontSize: 24, fontWeight: 'bold', color: couleurs.texte, textAlign: 'center', marginTop: 12 },
  ratingContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 12 },
  ratingText: { fontSize: 16, color: couleurs.texteDoux, marginLeft: 6 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: couleurs.texte, marginBottom: 8 },
  bioText: { fontSize: 14, color: couleurs.texteDoux, lineHeight: 20 },
  infoRow: { gap: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoItemText: { fontSize: 14, color: couleurs.texte, marginLeft: 12 },

  // Reviews
  reviewsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addReviewButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: couleurs.accent, marginBottom: 24 },
  addReviewButtonText: { fontSize: 14, color: couleurs.accent, fontWeight: '600' },
  noReviewsText: { fontSize: 13, color: couleurs.texteFaible, fontStyle: 'italic' },
  reviewCard: {
    backgroundColor: couleurs.fond, borderRadius: 12, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: couleurs.bord,
  },
  myReviewCard: { borderColor: couleurs.accentVoileFort, backgroundColor: couleurs.accentVoile },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: couleurs.accentVoile,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  reviewAvatarText: { fontSize: 16, fontWeight: '700', color: couleurs.accent },
  reviewInfo: { flex: 1 },
  reviewName: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
  reviewStars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewDateActions: { alignItems: 'flex-end', gap: 4 },
  reviewDate: { fontSize: 11, color: couleurs.texteFaible },
  deleteReviewBtn: { padding: 2 },
  reviewComment: { fontSize: 13, color: couleurs.texteDoux, lineHeight: 18 },
  starPicker: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
  ratingLabel: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: couleurs.accent, marginBottom: 12 },

  // Actions
  actionSection: { marginTop: 8 },
  currentCoachContainer: {
    backgroundColor: couleurs.succesVoile, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: couleurs.succes,
  },
  currentCoachTitle: { fontSize: 14, fontWeight: '600', color: couleurs.succes, marginBottom: 12 },
  messageButton: {
    flexDirection: 'row', backgroundColor: couleurs.succes, padding: 12,
    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  messageButtonText: { color: couleurs.texteInverse, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  infoContainer: { backgroundColor: couleurs.fond, padding: 16, borderRadius: 12 },
  infoTextStyle: { fontSize: 14, color: couleurs.texteDoux, lineHeight: 20 },
  requestStatusContainer: {
    backgroundColor: couleurs.infoVoile, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: couleurs.info,
  },
  requestStatusTitle: { fontSize: 14, fontWeight: '600', color: couleurs.info },
  requestMessageText: { fontSize: 12, color: couleurs.info, marginTop: 8 },
  requestButton: {
    flexDirection: 'row', backgroundColor: couleurs.accent, padding: 16,
    borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  requestButtonText: { color: couleurs.texteInverse, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  errorText: { fontSize: 16, color: couleurs.texteDoux, marginBottom: 16 },
  backButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: couleurs.accent, borderRadius: 8 },
  backButtonText: { color: couleurs.texteInverse, fontSize: 14, fontWeight: '600' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: { backgroundColor: couleurs.carte, borderRadius: 16, padding: 24, width: '100%', maxWidth: 500 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: couleurs.texte, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: couleurs.texteDoux, marginBottom: 16, lineHeight: 20 },
  messageInput: {
    borderWidth: 1, borderColor: couleurs.bord, borderRadius: 12,
    padding: 12, fontSize: 14, color: couleurs.texte, minHeight: 100, marginBottom: 20,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalButtonCancel: { backgroundColor: couleurs.fond },
  modalButtonCancelText: { color: couleurs.texteDoux, fontSize: 16, fontWeight: '600' },
  modalButtonSubmit: { backgroundColor: couleurs.accent },
  modalButtonSubmitText: { color: couleurs.texteInverse, fontSize: 16, fontWeight: '600' },
});

export default CoachDetailScreen;
