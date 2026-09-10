import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI, coachesAPI } from '../../services/api';
import { ALL_LOCATIONS } from '../../constants/locations';
import { couleurs } from '../../theme';

// -----------------------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------------------
const InputField = ({ label, value, onChangeText, placeholder, keyboardType, icon, multiline }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={[styles.inputWrapper, multiline && styles.inputWrapperMultiline]}>
      <Ionicons name={icon} size={20} color={couleurs.texteFaible} style={styles.inputIcon} />
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={couleurs.texteFaible}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  </View>
);

// -----------------------------------------------------------------------
// Écran principal
// -----------------------------------------------------------------------
const EditCoachProfileScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [coachData, setCoachData] = useState({
    bio: '',
    city: '',
    trainingLocations: [],
    isRemote: false,
  });

  const fetchCoachProfile = useCallback(async () => {
    try {
      if (user) {
        setFormData({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          phone: user.phone || '',
        });
      }
      const response = await coachesAPI.getMe();
      if (response.data.success) {
        const cp = response.data.data;
        setCoachData({
          bio: cp.bio || '',
          city: cp.city || '',
          trainingLocations: (cp.trainingLocations || []).filter((l) => l !== 'En ligne'),
          isRemote: cp.isRemote || false,
        });
      }
    } catch (error) {
      console.error('Erreur chargement profil coach:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCoachProfile();
  }, [fetchCoachProfile]);

  const toggleLocation = (location) => {
    setCoachData((prev) => ({
      ...prev,
      trainingLocations: prev.trainingLocations.includes(location)
        ? prev.trainingLocations.filter((l) => l !== location)
        : [...prev.trainingLocations, location],
    }));
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Erreur', 'Le prénom et le nom sont obligatoires');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Erreur', "L'email est obligatoire");
      return;
    }

    setSaving(true);
    try {
      // Mise à jour des infos utilisateur (nom, email, téléphone)
      const userRes = await authAPI.updateProfile(formData);
      await updateUser(userRes.data.data);

      // Mise à jour du profil coach (bio, ville, lieux, coaching distance)
      await coachesAPI.updateMyProfile({
        bio: coachData.bio || null,
        city: coachData.city || null,
        trainingLocations: coachData.trainingLocations,
        isRemote: coachData.isRemote,
      });

      Alert.alert('Succès', 'Profil mis à jour !', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erreur sauvegarde profil:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de mettre à jour le profil');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={couleurs.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">

        {/* Informations personnelles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <View style={styles.card}>
            <InputField
              label="Prénom"
              icon="person-outline"
              value={formData.firstName}
              onChangeText={(v) => setFormData((p) => ({ ...p, firstName: v }))}
              placeholder="Votre prénom"
            />
            <InputField
              label="Nom"
              icon="person-outline"
              value={formData.lastName}
              onChangeText={(v) => setFormData((p) => ({ ...p, lastName: v }))}
              placeholder="Votre nom"
            />
            <InputField
              label="Email"
              icon="mail-outline"
              value={formData.email}
              onChangeText={(v) => setFormData((p) => ({ ...p, email: v }))}
              placeholder="votre@email.com"
              keyboardType="email-address"
            />
            <InputField
              label="Téléphone"
              icon="call-outline"
              value={formData.phone}
              onChangeText={(v) => setFormData((p) => ({ ...p, phone: v }))}
              placeholder="06 12 34 56 78"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Profil coach */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil coach</Text>
          <View style={styles.card}>
            <InputField
              label="Biographie"
              icon="document-text-outline"
              value={coachData.bio}
              onChangeText={(v) => setCoachData((p) => ({ ...p, bio: v }))}
              placeholder="Décrivez votre expérience, spécialités..."
              multiline
            />
            <InputField
              label="Ville"
              icon="location-outline"
              value={coachData.city}
              onChangeText={(v) => setCoachData((p) => ({ ...p, city: v }))}
              placeholder="Paris, Lyon, Marseille..."
            />

            {/* Coaching à distance */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="videocam-outline" size={20} color={couleurs.texteFaible} style={styles.inputIcon} />
                <View>
                  <Text style={styles.switchLabel}>Coaching à distance</Text>
                  <Text style={styles.switchSubLabel}>Proposez des séances en visio</Text>
                </View>
              </View>
              <Switch
                value={coachData.isRemote}
                onValueChange={(v) => setCoachData((p) => ({ ...p, isRemote: v }))}
                trackColor={{ false: couleurs.bordFort, true: couleurs.accentVoileFort }}
                thumbColor={coachData.onlineCoaching ? couleurs.accent : couleurs.texteFaible}
              />
            </View>
          </View>
        </View>

        {/* Lieux d'entraînement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lieux d'entraînement</Text>
          <Text style={styles.sectionSubtitle}>
            Sélectionnez vos salles et lieux de coaching
          </Text>
          <View style={styles.locationsGrid}>
            {ALL_LOCATIONS.map((location) => {
              const selected = coachData.trainingLocations.includes(location);
              return (
                <TouchableOpacity
                  key={location}
                  style={[styles.locationChip, selected && styles.locationChipActive]}
                  onPress={() => toggleLocation(location)}
                >
                  {selected && (
                    <Ionicons name="checkmark" size={14} color={couleurs.accent} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.locationChipText, selected && styles.locationChipTextActive]}>
                    {location}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Boutons */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={couleurs.texteInverse} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={22} color={couleurs.texteInverse} />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: couleurs.texte,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginBottom: 12,
  },
  card: {
    backgroundColor: couleurs.carte,
    borderRadius: 12,
    padding: 16,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginTop: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fond,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    paddingTop: 12,
    minHeight: 90,
  },
  inputIcon: {
    marginRight: 10,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: couleurs.texte,
  },
  inputMultiline: {
    color: couleurs.texte,
    paddingVertical: 0,
    minHeight: 70,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
  },
  switchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texte,
  },
  switchSubLabel: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 1,
  },
  locationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  locationChipActive: {
    backgroundColor: couleurs.accentVoile,
    borderColor: couleurs.accent,
  },
  locationChipText: {
    fontSize: 13,
    color: couleurs.texteFaible,
    fontWeight: '500',
  },
  locationChipTextActive: {
    color: couleurs.accent,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.accent,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: couleurs.texteInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    color: couleurs.texteFaible,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default EditCoachProfileScreen;
