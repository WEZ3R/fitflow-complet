import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView,
  ScrollView, Switch,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import StepProgress from '../../../components/StepProgress';
import SelectCard from '../../../components/SelectCard';
import TextField from '../../../components/TextField';
import PrimaryButton from '../../../components/PrimaryButton';
import { gymsAPI, onboardingAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { couleurs } from '../../../theme';

const SPECIALTIES = [
  { value: 'STRENGTH', label: 'Force', icon: '🏋️' },
  { value: 'HYPERTROPHY', label: 'Hypertrophie', icon: '💪' },
  { value: 'WEIGHT_LOSS', label: 'Perte de poids', icon: '⚖️' },
  { value: 'REHAB', label: 'Rééducation', icon: '🏥' },
  { value: 'ENDURANCE', label: 'Endurance', icon: '🚴' },
  { value: 'CROSSFIT', label: 'CrossFit', icon: '🔥' },
  { value: 'YOGA', label: 'Yoga', icon: '🧘' },
  { value: 'MOBILITY', label: 'Mobilité', icon: '🤸' },
  { value: 'POWERLIFTING', label: 'Powerlifting', icon: '🏆' },
  { value: 'BODYBUILDING', label: 'Bodybuilding', icon: '🥇' },
];

const TOTAL_STEPS = 2;

const CoachOnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { updateUser } = useAuth();

  // Étape 1
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState([]);
  const [isRemote, setIsRemote] = useState(false);

  // Étape 2
  const [cityInput, setCityInput] = useState('');
  const [gyms, setGyms] = useState([]);
  const [gymIds, setGymIds] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const toggleSpecialty = (val) => {
    setSpecialties((s) => s.includes(val) ? s.filter((x) => x !== val) : [...s, val]);
  };

  const toggleGym = (id) => {
    setGymIds((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  const searchCity = async () => {
    if (!cityInput.trim()) return;
    setSearchLoading(true);
    try {
      const res = await gymsAPI.search(cityInput.trim());
      const list = res.data?.data || [];
      setGyms(list);
      if (list.length > 0) {
        setMapRegion({ latitude: list[0].latitude, longitude: list[0].longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
      }
    } catch {
      Alert.alert('Erreur', "Ville introuvable.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (specialties.length === 0) {
      Alert.alert('Info', 'Sélectionnez au moins une spécialité');
      return;
    }
    setLoading(true);
    try {
      const res = await onboardingAPI.submitCoach({
        bio, specialties, city: cityInput.trim() || undefined,
        gymIds, isRemote,
      });
      if (updateUser) updateUser({ onboardingCompletedAt: new Date().toISOString() });
      navigation.replace('Main');
    } catch {
      Alert.alert('Erreur', "Impossible de sauvegarder votre profil.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(1) : null} style={[styles.headerBtn, step === 1 && styles.hidden]}>
          <Ionicons name="arrow-back" size={22} color={couleurs.texte} />
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <StepProgress total={TOTAL_STEPS} current={step} />
        </View>
        <TouchableOpacity onPress={() => navigation.replace('Main')} style={styles.headerBtn}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Étape 1 — Profil */}
      {step === 1 && (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Votre profil coach</Text>
          <Text style={styles.subtitle}>Présentez vos spécialités pour être mis en avant auprès des bons clients.</Text>

          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Parlez de votre expérience, méthode, valeurs..."
            multiline
            numberOfLines={3}
            optional
          />

          <Text style={styles.sectionLabel}>Spécialités</Text>
          <View style={styles.grid}>
            {SPECIALTIES.map((s) => (
              <SelectCard
                key={s.value}
                label={s.label}
                icon={s.icon}
                selected={specialties.includes(s.value)}
                onPress={() => toggleSpecialty(s.value)}
              />
            ))}
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Coaching à distance</Text>
              <Text style={styles.switchSub}>Visio, programmes en ligne</Text>
            </View>
            <Switch
              value={isRemote}
              onValueChange={setIsRemote}
              trackColor={{ false: couleurs.bordFort, true: couleurs.accent }}
              thumbColor={couleurs.texte}
            />
          </View>

          <PrimaryButton label="Continuer" onPress={() => setStep(2)} />
        </ScrollView>
      )}

      {/* Étape 2 — Localisation */}
      {step === 2 && (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Où entraînez-vous ?</Text>
          <Text style={styles.subtitle}>Indiquez votre ville et les salles où vous intervenez.</Text>

          <View style={styles.searchRow}>
            <View style={styles.searchFlex}>
              <TextField
                label="Votre ville"
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="Ex: Lyon"
                onSubmitEditing={searchCity}
                returnKeyType="search"
              />
            </View>
          </View>
          <PrimaryButton label={searchLoading ? 'Recherche...' : 'Trouver les salles'} onPress={searchCity} loading={searchLoading} variant="secondary" />

          {mapRegion && (
            <View style={styles.mapContainer}>
              <MapView style={styles.map} region={mapRegion}>
                {gyms.map((g) => (
                  <Marker key={g.id} coordinate={{ latitude: g.latitude, longitude: g.longitude }} title={g.name}
                    pinColor={gymIds.includes(g.id) ? couleurs.accent : couleurs.danger} onPress={() => toggleGym(g.id)} />
                ))}
              </MapView>
            </View>
          )}

          {gyms.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Salles ({gyms.length})</Text>
              {gyms.map((g) => {
                const sel = gymIds.includes(g.id);
                return (
                  <TouchableOpacity key={g.id} style={[styles.gymRow, sel && styles.gymSel]} onPress={() => toggleGym(g.id)}>
                    <Text style={styles.gymName}>{g.name}</Text>
                    <Ionicons name={sel ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={sel ? couleurs.accent : couleurs.texteFaible} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <PrimaryButton label="Terminer" onPress={handleSubmit} loading={loading} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: couleurs.fond },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, paddingHorizontal: 4 },
  headerBtn: { padding: 10, width: 60, alignItems: 'center' },
  progressWrap: { flex: 1, paddingHorizontal: 4 },
  hidden: { opacity: 0 },
  skipText: { color: couleurs.texteDoux, fontSize: 14, fontWeight: '500' },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: 8 },
  subtitle: { fontSize: 14, color: couleurs.texteDoux, marginBottom: 24, lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginBottom: 20 },
  switchLabel: { fontSize: 15, fontWeight: '500', color: couleurs.texte },
  switchSub: { fontSize: 12, color: couleurs.texteDoux, marginTop: 2 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchFlex: { flex: 1 },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', marginVertical: 16 },
  map: { flex: 1 },
  section: { marginTop: 8 },
  gymRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: couleurs.carte, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: couleurs.bord },
  gymSel: { borderColor: couleurs.accent, backgroundColor: couleurs.accentVoile },
  gymName: { fontSize: 14, fontWeight: '500', color: couleurs.texte, flex: 1 },
});

export default CoachOnboardingScreen;
