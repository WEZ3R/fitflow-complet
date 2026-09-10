import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, clientsAPI, coachesAPI } from '../services/api';
import { API_URL } from '../../config';
import Avatar from '../components/Avatar';
import { couleurs } from '../theme';

const ProfileScreen = ({ navigation, onGoToCoaches }) => {
  const { user, logout, updateUser } = useAuth();
  const [clientProfile, setClientProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restTimerEnabled, setRestTimerEnabled] = useState(true);
  const [visibleInSearch, setVisibleInSearch] = useState(true);
  const [visibleInProspection, setVisibleInProspection] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePickPhoto = async () => {
    // Demander la permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'L\'accès à la galerie est nécessaire pour changer la photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append('profilePicture', {
      uri: asset.uri,
      name: asset.fileName || 'photo.jpg',
      type: asset.mimeType || 'image/jpeg',
    });

    setUploadingPhoto(true);
    try {
      let response;
      if (user?.role === 'COACH') {
        response = await coachesAPI.updateMyProfile(formData);
      } else {
        response = await clientsAPI.updateMe(formData);
      }
      if (response.data.success) {
        // Re-fetcher le profil complet depuis /auth/me pour mettre à jour le contexte
        const meResponse = await authAPI.getMe();
        if (meResponse.data.success) {
          await updateUser(meResponse.data.data);
        }
        // Rafraîchir l'affichage du profil client (coaches exclus)
        if (user?.role === 'CLIENT') {
          await fetchProfile();
        }
      }
    } catch (error) {
      console.error('Erreur upload photo:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo de profil.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await clientsAPI.getMe();
      if (response.data.success) {
        setClientProfile(response.data.data);
        const v = response.data.data?.visibleInProspection;
        setVisibleInProspection(v === undefined ? true : !!v);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoadingProfile(false);
      setRefreshing(false);
    }
  };

  const handleToggleProspection = async (val) => {
    setVisibleInProspection(val);
    try {
      await clientsAPI.updateMe({ visibleInProspection: val });
    } catch (e) {
      setVisibleInProspection(!val);
      Alert.alert('Erreur', 'Impossible de mettre à jour la visibilité.');
    }
  };

  useEffect(() => {
    if (user?.role === 'CLIENT') fetchProfile();
    else setLoadingProfile(false);
    SecureStore.getItemAsync('restTimerEnabled').then(val => {
      setRestTimerEnabled(val !== 'false');
    });
  }, []);

  // Synchroniser le switch visibilité depuis le profil coach
  useEffect(() => {
    if (user?.role !== 'COACH') return;
    coachesAPI.getMe()
      .then(res => {
        if (res.data?.success && res.data?.data) {
          // Champ optionnel : tant que la migration backend n'est pas faite,
          // on retombe sur true (valeur par défaut souhaitée)
          const v = res.data.data.visibleInSearch;
          setVisibleInSearch(v === undefined ? true : !!v);
        }
      })
      .catch(() => { /* silencieux */ });
  }, [user?.role]);

  const handleToggleVisibility = async (val) => {
    setVisibleInSearch(val);
    try {
      await coachesAPI.updateMyProfile({ visibleInSearch: val });
    } catch (e) {
      // Rollback en cas d'échec
      setVisibleInSearch(!val);
      Alert.alert('Erreur', 'Impossible de mettre à jour la visibilité.');
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Se déconnecter',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Se déconnecter', style: 'destructive', onPress: handleLogout },
      ]
    );
  };

  // Rafraîchir au retour de EditProfile (clients uniquement)
  useEffect(() => {
    if (user?.role !== 'CLIENT') return;
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProfile();
    });
    return unsubscribe;
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const formatDateToFrench = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getLevelLabel = (level) => {
    switch (level) {
      case 'BEGINNER':
      case 'debutant': return 'Débutant';
      case 'INTERMEDIATE':
      case 'intermediaire': return 'Intermédiaire';
      case 'ADVANCED':
      case 'avance': return 'Avancé';
      default: return level;
    }
  };

  const getGenderLabel = (gender) => {
    switch (gender) {
      case 'M': return 'Homme';
      case 'F': return 'Femme';
      case 'X': return 'Autre';
      default: return gender;
    }
  };

  const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={20} color={couleurs.info} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || 'Non renseigné'}</Text>
      </View>
    </View>
  );

  if (loadingProfile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />}
      >
        <View style={styles.header}>
          <View style={styles.avatarWrapper}>
            <Avatar user={user} size={100} onPress={handlePickPhoto} />
            {uploadingPhoto ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color={couleurs.texteInverse} />
              </View>
            ) : (
              <TouchableOpacity style={styles.cameraButton} onPress={handlePickPhoto}>
                <Ionicons name="camera" size={16} color={couleurs.texteInverse} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.name}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.role}>
            {user?.role === 'CLIENT' ? 'Client' : 'Coach'}
          </Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Ionicons name="create-outline" size={20} color={couleurs.info} />
            <Text style={styles.editButtonText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <View style={styles.card}>
            <InfoRow icon="mail-outline" label="Email" value={user?.email} />
            <InfoRow icon="call-outline" label="Téléphone" value={user?.phone} />
            <InfoRow
              icon="calendar-outline"
              label="Date de naissance"
              value={formatDateToFrench(user?.birthDate || clientProfile?.dateOfBirth)}
            />
            <InfoRow
              icon="person-outline"
              label="Genre"
              value={getGenderLabel(clientProfile?.gender)}
            />
          </View>
        </View>

        {user?.role === 'CLIENT' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations sportives</Text>
            <View style={styles.card}>
              <InfoRow
                icon="trophy-outline"
                label="Objectif"
                value={clientProfile?.goals}
              />
              <InfoRow
                icon="barbell-outline"
                label="Niveau"
                value={getLevelLabel(clientProfile?.level)}
              />
              <InfoRow
                icon="scale-outline"
                label="Poids"
                value={clientProfile?.weight ? `${clientProfile.weight} kg` : null}
              />
              <InfoRow
                icon="resize-outline"
                label="Taille"
                value={clientProfile?.height ? `${clientProfile.height} cm` : null}
              />
            </View>
          </View>
        )}

        {user?.role === 'CLIENT' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mes Coachs</Text>
            {clientProfile?.coaches && clientProfile.coaches.length > 0 ? (
              <View style={styles.card}>
                {clientProfile.coaches.map((relation, index) => (
                  <View
                    key={relation.id}
                    style={[
                      styles.coachRow,
                      index < clientProfile.coaches.length - 1 && styles.coachRowBorder,
                    ]}
                  >
                    {/* Avatar initiales */}
                    <View style={styles.coachAvatar}>
                      <Text style={styles.coachAvatarText}>
                        {relation.coach?.user?.firstName?.[0] || '?'}
                        {relation.coach?.user?.lastName?.[0] || ''}
                      </Text>
                    </View>
                    <View style={styles.coachInfo}>
                      <Text style={styles.coachName}>
                        {relation.coach?.user?.firstName} {relation.coach?.user?.lastName}
                      </Text>
                      {relation.isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Principal</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.emptyCoachContainer}>
                  <Ionicons name="people-outline" size={40} color={couleurs.texteFaible} />
                  <Text style={styles.emptyCoachText}>Vous n'avez pas encore de coach</Text>
                  <TouchableOpacity
                    style={styles.findCoachButton}
                    onPress={() => onGoToCoaches ? onGoToCoaches() : navigation.navigate('CoachSearch')}
                  >
                    <Text style={styles.findCoachButtonText}>Trouver un coach</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          <View style={styles.card}>
            {user?.role === 'CLIENT' && (
              <>
                <View style={[styles.settingRow, styles.settingRowBorder]}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="timer-outline" size={20} color={couleurs.info} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>Chrono de repos</Text>
                    <Text style={styles.settingSubLabel}>Lance un décompte entre les séries</Text>
                  </View>
                  <Switch
                    value={restTimerEnabled}
                    onValueChange={async (val) => {
                      setRestTimerEnabled(val);
                      await SecureStore.setItemAsync('restTimerEnabled', val.toString());
                    }}
                    trackColor={{ false: couleurs.bordFort, true: couleurs.accent }}
                    thumbColor={couleurs.texte}
                  />
                </View>

                <View style={[styles.settingRow, styles.settingRowBorder]}>
                  <View style={styles.settingIcon}>
                    <Ionicons name="eye-outline" size={20} color={couleurs.info} />
                  </View>
                  <View style={styles.settingContent}>
                    <Text style={styles.settingLabel}>Visible aux coachs</Text>
                    <Text style={styles.settingSubLabel}>
                      Apparaître dans la prospection des coachs
                    </Text>
                  </View>
                  <Switch
                    value={visibleInProspection}
                    onValueChange={handleToggleProspection}
                    trackColor={{ false: couleurs.bordFort, true: couleurs.accent }}
                    thumbColor={couleurs.texte}
                  />
                </View>
              </>
            )}

            {user?.role === 'COACH' && (
              <View style={[styles.settingRow, styles.settingRowBorder]}>
                <View style={styles.settingIcon}>
                  <Ionicons name="search-outline" size={20} color={couleurs.info} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>Visible dans la recherche</Text>
                  <Text style={styles.settingSubLabel}>
                    Apparaître aux clients qui cherchent un coach
                  </Text>
                </View>
                <Switch
                  value={visibleInSearch}
                  onValueChange={handleToggleVisibility}
                  trackColor={{ false: couleurs.bordFort, true: couleurs.accent }}
                  thumbColor={couleurs.texte}
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.settingRow}
              onPress={confirmLogout}
              activeOpacity={0.6}
            >
              <View style={[styles.settingIcon, styles.settingIconDanger]}>
                <Ionicons name="log-out-outline" size={20} color={couleurs.danger} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, styles.settingLabelDanger]}>
                  Se déconnecter
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={couleurs.texteFaible} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 64,
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: couleurs.carte,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  avatarOverlay: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: couleurs.accent,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    // Le liseré détache la photo de la carte qui la porte.
    borderColor: couleurs.carte,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginTop: 16,
  },
  role: {
    fontSize: 14,
    color: couleurs.texteFaible,
    marginTop: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.infoVoile,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: couleurs.info,
  },
  editButtonText: {
    color: couleurs.info,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: couleurs.texte,
    marginBottom: 12,
  },
  card: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 4,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.infoVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: couleurs.texte,
    fontWeight: '500',
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  coachRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  coachAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: couleurs.accentVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coachAvatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: couleurs.accent,
  },
  coachInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coachName: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
  },
  primaryBadge: {
    backgroundColor: couleurs.alerteVoile,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 6,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: couleurs.alerte,
  },
  emptyCoachContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  emptyCoachText: {
    fontSize: 14,
    color: couleurs.texteFaible,
    marginTop: 10,
    marginBottom: 16,
  },
  findCoachButton: {
    backgroundColor: couleurs.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  findCoachButtonText: {
    color: couleurs.texteInverse,
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  settingRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: couleurs.infoVoile,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIconDanger: {
    backgroundColor: couleurs.dangerVoile,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
  },
  settingLabelDanger: {
    color: couleurs.danger,
  },
  settingSubLabel: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
});

export default ProfileScreen;
