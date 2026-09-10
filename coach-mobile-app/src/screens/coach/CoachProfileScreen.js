import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { coachesAPI } from '../../services/api';
import Avatar from '../../components/Avatar';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Écran Profil Coach
// -----------------------------------------------------------------------
const CoachProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [coachProfile, setCoachProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const coachRes = await coachesAPI.getMe();
      if (coachRes.data.success) {
        setCoachProfile(coachRes.data.data);
      }
    } catch (error) {
      console.error('Erreur chargement profil coach:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Rafraîchir au retour de EditCoachProfile
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchData);
    return unsubscribe;
  }, [navigation, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => { await logout(); },
        },
      ]
    );
  };

  const InfoRow = ({ icon, label, value }) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Ionicons name={icon} size={18} color={couleurs.accent} style={styles.infoIcon} />
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[couleurs.accent]} />
        }
      >
        {/* Header profil */}
        <View style={styles.profileHeader}>
          <Avatar user={user} size={88} />
          <Text style={styles.profileName}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.profileRole}>Coach</Text>
          {user?.email && (
            <Text style={styles.profileEmail}>{user.email}</Text>
          )}

          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('EditCoachProfile')}
          >
            <Ionicons name="create-outline" size={18} color={couleurs.accent} />
            <Text style={styles.editProfileText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Bio & infos */}
        {coachProfile && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations</Text>
            <View style={styles.card}>
              {coachProfile.bio ? (
                <View style={styles.bioContainer}>
                  <Text style={styles.bioText}>{coachProfile.bio}</Text>
                </View>
              ) : null}
              <InfoRow icon="location-outline" label="Ville" value={coachProfile.city} />
              <InfoRow
                icon="storefront-outline"
                label="Lieux d'entraînement"
                value={Array.isArray(coachProfile.trainingLocations) && coachProfile.trainingLocations.length > 0
                  ? coachProfile.trainingLocations.filter((l) => l !== 'En ligne').join(' · ') || null
                  : null}
              />
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Ionicons name="videocam-outline" size={18} color={couleurs.accent} style={styles.infoIcon} />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Coaching à distance</Text>
                    <Text style={styles.infoValue}>
                      {coachProfile.isRemote ? 'Disponible' : 'Non disponible'}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.toggleBadge,
                  coachProfile.isRemote ? styles.toggleBadgeOn : styles.toggleBadgeOff,
                ]}>
                  <Text style={[
                    styles.toggleBadgeText,
                    coachProfile.isRemote ? styles.toggleBadgeTextOn : styles.toggleBadgeTextOff,
                  ]}>
                    {coachProfile.isRemote ? 'Oui' : 'Non'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Déconnexion */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={couleurs.texteInverse} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  // Header
  profileHeader: {
    backgroundColor: couleurs.carte,
    alignItems: 'center',
    paddingTop: 64,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: couleurs.texte,
    marginTop: 14,
  },
  profileRole: {
    fontSize: 14,
    color: couleurs.accent,
    fontWeight: '600',
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginTop: 4,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.accentVoile,
  },
  editProfileText: {
    fontSize: 14,
    color: couleurs.accent,
    fontWeight: '600',
  },
  // Section
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 12,
  },
  // Carte infos
  card: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  bioText: {
    fontSize: 14,
    color: couleurs.texteDoux,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  infoIcon: {
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
    fontSize: 14,
    color: couleurs.texte,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  toggleBadgeOn: {
    backgroundColor: couleurs.succesVoile,
  },
  toggleBadgeOff: {
    backgroundColor: couleurs.fond,
  },
  toggleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  toggleBadgeTextOn: {
    color: couleurs.succes,
  },
  toggleBadgeTextOff: {
    color: couleurs.texteFaible,
  },
  // Déconnexion
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.danger,
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutText: {
    color: couleurs.texteInverse,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CoachProfileScreen;
