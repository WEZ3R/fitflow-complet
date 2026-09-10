import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, clientsAPI } from '../services/api';
import { GYM_CHAINS } from '../constants/locations';
import { couleurs } from '../theme';

// Fonction pour formater la date en JJ/MM/AAAA
const formatDateToFrench = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Fonction pour convertir JJ/MM/AAAA en ISO
const convertFrenchDateToISO = (frenchDate) => {
  if (!frenchDate) return null;
  const parts = frenchDate.split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Composant InputField
const InputField = React.memo(({ label, value, onChangeText, placeholder, keyboardType, icon }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputWrapper}>
      <Ionicons name={icon} size={20} color={couleurs.texteFaible} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={couleurs.texteFaible}
        keyboardType={keyboardType || 'default'}
      />
    </View>
  </View>
));

// Composant SelectField (boutons radio)
const SelectField = React.memo(({ label, icon, options, value, onChange }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.optionsRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.optionButton, value === opt.value && styles.optionButtonActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.optionText, value === opt.value && styles.optionTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
));

const EditProfileScreen = ({ navigation }) => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
  });

  const [clientData, setClientData] = useState({
    goals: '',
    level: '',
    weight: '',
    height: '',
    gender: '',
    city: '',
    trainingLocations: [],
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        birthDate: formatDateToFrench(user.birthDate) || '',
      });
    }
    fetchClientProfile();
  }, []);

  const fetchClientProfile = async () => {
    try {
      const response = await clientsAPI.getMe();
      if (response.data.success) {
        const cp = response.data.data;
        setClientData({
          goals: cp.goals || '',
          level: cp.level || '',
          weight: cp.weight?.toString() || '',
          height: cp.height?.toString() || '',
          gender: cp.gender || '',
          city: cp.city || '',
          trainingLocations: cp.trainingLocations || [],
        });
      }
    } catch (error) {
      console.error('Error fetching client profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Handlers
  const handleFirstNameChange = useCallback((text) => {
    setFormData(prev => ({ ...prev, firstName: text }));
  }, []);
  const handleLastNameChange = useCallback((text) => {
    setFormData(prev => ({ ...prev, lastName: text }));
  }, []);
  const handleEmailChange = useCallback((text) => {
    setFormData(prev => ({ ...prev, email: text }));
  }, []);
  const handlePhoneChange = useCallback((text) => {
    setFormData(prev => ({ ...prev, phone: text }));
  }, []);

  const handleDateChange = useCallback((text) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    cleaned = cleaned.substring(0, 8);
    let formatted = cleaned;
    if (cleaned.length >= 2) {
      formatted = cleaned.substring(0, 2);
      if (cleaned.length >= 3) {
        formatted += '/' + cleaned.substring(2, 4);
        if (cleaned.length >= 5) {
          formatted += '/' + cleaned.substring(4, 8);
        }
      }
    }
    setFormData(prev => ({ ...prev, birthDate: formatted }));
  }, []);

  const handleSave = async () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      Alert.alert('Erreur', 'Le prénom et le nom sont obligatoires');
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert('Erreur', "L'email est obligatoire");
      return;
    }

    setLoading(true);
    try {
      // Sauvegarder infos utilisateur
      const dataToSend = {
        ...formData,
        birthDate: convertFrenchDateToISO(formData.birthDate),
      };
      const response = await authAPI.updateProfile(dataToSend);
      const updatedUser = response.data.data;
      await updateUser(updatedUser);

      // Sauvegarder infos client (goals, level, weight, height, gender)
      if (user?.role === 'CLIENT') {
        await clientsAPI.updateMe({
          goals: clientData.goals || null,
          level: clientData.level || null,
          weight: clientData.weight ? parseFloat(clientData.weight) : null,
          height: clientData.height ? parseFloat(clientData.height) : null,
          gender: clientData.gender || null,
          city: clientData.city || null,
          trainingLocations: clientData.trainingLocations,
        });
      }

      Alert.alert('Succès', 'Profil mis à jour avec succès', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Impossible de mettre à jour le profil'
      );
    } finally {
      setLoading(false);
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
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations personnelles</Text>
          <View style={styles.card}>
            <InputField
              label="Prénom"
              icon="person-outline"
              value={formData.firstName}
              onChangeText={handleFirstNameChange}
              placeholder="Votre prénom"
            />
            <InputField
              label="Nom"
              icon="person-outline"
              value={formData.lastName}
              onChangeText={handleLastNameChange}
              placeholder="Votre nom"
            />
            <InputField
              label="Email"
              icon="mail-outline"
              value={formData.email}
              onChangeText={handleEmailChange}
              placeholder="votre@email.com"
              keyboardType="email-address"
            />
            <InputField
              label="Téléphone"
              icon="call-outline"
              value={formData.phone}
              onChangeText={handlePhoneChange}
              placeholder="06 12 34 56 78"
              keyboardType="phone-pad"
            />
            <InputField
              label="Date de naissance"
              icon="calendar-outline"
              value={formData.birthDate}
              onChangeText={handleDateChange}
              placeholder="JJ/MM/AAAA"
              keyboardType="numeric"
            />
          </View>
        </View>

        {user?.role === 'CLIENT' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations sportives</Text>
            <View style={styles.card}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Objectifs</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="trophy-outline" size={20} color={couleurs.texteFaible} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                    value={clientData.goals}
                    onChangeText={(text) => setClientData(prev => ({ ...prev, goals: text }))}
                    placeholder="Décrivez vos objectifs..."
                    placeholderTextColor={couleurs.texteFaible}
                    multiline
                  />
                </View>
              </View>

              <SelectField
                label="Niveau"
                icon="barbell-outline"
                options={[
                  { value: 'debutant', label: 'Débutant' },
                  { value: 'intermediaire', label: 'Intermédiaire' },
                  { value: 'avance', label: 'Avancé' },
                ]}
                value={clientData.level}
                onChange={(val) => setClientData(prev => ({ ...prev, level: val }))}
              />

              <View style={styles.rowFields}>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Poids (kg)"
                    icon="scale-outline"
                    value={clientData.weight}
                    onChangeText={(text) => setClientData(prev => ({ ...prev, weight: text }))}
                    placeholder="75"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Taille (cm)"
                    icon="resize-outline"
                    value={clientData.height}
                    onChangeText={(text) => setClientData(prev => ({ ...prev, height: text }))}
                    placeholder="175"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <SelectField
                label="Genre"
                icon="person-outline"
                options={[
                  { value: 'M', label: 'Homme' },
                  { value: 'F', label: 'Femme' },
                  { value: 'X', label: 'Autre' },
                ]}
                value={clientData.gender}
                onChange={(val) => setClientData(prev => ({ ...prev, gender: val }))}
              />

              <InputField
                label="Ville"
                icon="location-outline"
                value={clientData.city}
                onChangeText={(text) => setClientData(prev => ({ ...prev, city: text }))}
                placeholder="Paris, Lyon, Marseille..."
              />

              {/* Lieux d'entraînement */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Salles de sport</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gymChipsContainer}>
                  {GYM_CHAINS.map((gym) => {
                    const isSelected = clientData.trainingLocations.includes(gym);
                    return (
                      <TouchableOpacity
                        key={gym}
                        style={[styles.gymChip, isSelected && styles.gymChipActive]}
                        onPress={() => {
                          setClientData(prev => ({
                            ...prev,
                            trainingLocations: isSelected
                              ? prev.trainingLocations.filter((l) => l !== gym)
                              : [...prev.trainingLocations, gym],
                          }));
                        }}
                      >
                        <Text style={[styles.gymChipText, isSelected && styles.gymChipTextActive]}>
                          {gym}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={couleurs.texteInverse} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={24} color={couleurs.texteInverse} />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Annuler</Text>
          </TouchableOpacity>
        </View>
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
    padding: 16,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 8,
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
  inputIcon: {
    marginRight: 12,
    flexShrink: 0,
    width: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: couleurs.texte,
    minWidth: 0,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
    backgroundColor: couleurs.fond,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: couleurs.infoVoile,
    borderColor: couleurs.info,
  },
  optionText: {
    fontSize: 14,
    color: couleurs.texteFaible,
    fontWeight: '500',
  },
  optionTextActive: {
    color: couleurs.info,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.info,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: couleurs.ombre,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  saveButtonDisabled: {
    backgroundColor: couleurs.eleve,
  },
  saveButtonText: {
    color: couleurs.texteInverse,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: couleurs.texteFaible,
    fontSize: 16,
    fontWeight: '600',
  },
  gymChipsContainer: {
    flexDirection: 'row',
  },
  gymChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: couleurs.fond,
    marginRight: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  gymChipActive: {
    backgroundColor: couleurs.infoVoile,
    borderColor: couleurs.info,
  },
  gymChipText: {
    fontSize: 13,
    color: couleurs.texteFaible,
    fontWeight: '500',
  },
  gymChipTextActive: {
    color: couleurs.info,
    fontWeight: '600',
  },
});

export default EditProfileScreen;
