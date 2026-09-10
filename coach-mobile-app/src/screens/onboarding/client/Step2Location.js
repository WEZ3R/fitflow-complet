import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Modal, FlatList, ActivityIndicator, TextInput,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import TextField from '../../../components/TextField';
import PrimaryButton from '../../../components/PrimaryButton';
import { gymsAPI } from '../../../services/api';
import { couleurs } from '../../../theme';

const SPOT_TYPES = [
  { value: 'PARK', label: 'Parc', icon: '🌳' },
  { value: 'TRACK', label: 'Piste', icon: '🏃' },
  { value: 'HOME', label: 'Domicile', icon: '🏠' },
  { value: 'OUTDOOR', label: 'Outdoor', icon: '⛰️' },
  { value: 'POOL', label: 'Piscine', icon: '🏊' },
  { value: 'OTHER', label: 'Autre', icon: '📍' },
];

const Step2Location = ({ data, onChange, onNext }) => {
  const [cityInput, setCityInput] = useState(data.city || '');
  const [gyms, setGyms] = useState([]);
  const [mapRegion, setMapRegion] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [gymFilter, setGymFilter] = useState('');
  const [showSpotModal, setShowSpotModal] = useState(false);
  const [newSpotType, setNewSpotType] = useState('PARK');
  const [newSpotLabel, setNewSpotLabel] = useState('');
  const [newSpotAddress, setNewSpotAddress] = useState('');

  const searchCity = async () => {
    if (!cityInput.trim()) return;
    setSearchLoading(true);
    try {
      const res = await gymsAPI.search(cityInput.trim());
      const gymList = res.data?.data || [];
      setGyms(gymList);
      onChange({ city: cityInput.trim(), gymIds: [] });
      // Centrer la carte sur la 1ère salle ou utiliser geocoder natif
      if (gymList.length > 0) {
        setMapRegion({
          latitude: gymList[0].latitude,
          longitude: gymList[0].longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible de trouver cette ville. Vérifiez l'orthographe.");
    } finally {
      setSearchLoading(false);
    }
  };

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Activez la localisation dans les paramètres.');
      return;
    }
    setSearchLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const res = await gymsAPI.search(null, latitude, longitude);
      const gymList = res.data?.data || [];
      setGyms(gymList);
      setMapRegion({ latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setSearchLoading(false);
    }
  };

  const toggleGym = (gymId) => {
    const current = data.gymIds || [];
    if (current.includes(gymId)) {
      onChange({ gymIds: current.filter((id) => id !== gymId) });
    } else {
      onChange({ gymIds: [...current, gymId] });
    }
  };

  const addCustomSpot = () => {
    if (!newSpotLabel.trim()) return;
    const spots = data.customSpots || [];
    onChange({ customSpots: [...spots, { type: newSpotType, label: newSpotLabel.trim(), address: newSpotAddress.trim() || undefined }] });
    setNewSpotLabel('');
    setNewSpotAddress('');
    setNewSpotType('PARK');
    setShowSpotModal(false);
  };

  const removeSpot = (idx) => {
    const spots = [...(data.customSpots || [])];
    spots.splice(idx, 1);
    onChange({ customSpots: spots });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Où vous entraînez-vous ?</Text>
      <Text style={styles.subtitle}>Trouvez vos salles et lieux habituels pour qu'on vous recommande les meilleurs coachs.</Text>

      {/* Recherche ville */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <TextField
            label="Votre ville"
            value={cityInput}
            onChangeText={setCityInput}
            placeholder="Ex: Paris"
            onSubmitEditing={searchCity}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity style={styles.geoBtn} onPress={useMyLocation}>
          <Ionicons name="location" size={20} color={couleurs.accent} />
        </TouchableOpacity>
      </View>

      <PrimaryButton
        label={searchLoading ? 'Recherche...' : 'Trouver les salles'}
        onPress={searchCity}
        loading={searchLoading}
        variant="secondary"
      />

      {/* Carte */}
      {mapRegion && (
        <View style={styles.mapContainer}>
          <MapView style={styles.map} region={mapRegion} onRegionChangeComplete={setMapRegion}>
            {gyms.map((gym) => (
              <Marker
                key={gym.id}
                coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
                title={gym.name}
                description={gym.address || ''}
                pinColor={(data.gymIds || []).includes(gym.id) ? couleurs.accent : couleurs.danger}
                onPress={() => toggleGym(gym.id)}
              />
            ))}
          </MapView>
        </View>
      )}

      {/* Liste des salles */}
      {gyms.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Salles trouvées ({gyms.length})</Text>
          {/* Filtre */}
          <View style={styles.filterRow}>
            <Ionicons name="search" size={16} color={couleurs.texteFaible} style={styles.filterIcon} />
            <TextInput
              style={styles.filterInput}
              value={gymFilter}
              onChangeText={setGymFilter}
              placeholder="Filtrer les salles..."
              placeholderTextColor={couleurs.texteFaible}
            />
          </View>
          {gyms
            .filter((g) => !gymFilter || `${g.brand || ''} ${g.name}`.toLowerCase().includes(gymFilter.toLowerCase()))
            .slice(0, 4)
            .map((gym) => {
              const selected = (data.gymIds || []).includes(gym.id);
              const displayName = gym.brand && !gym.name.toLowerCase().includes(gym.brand.toLowerCase())
                ? `${gym.brand} — ${gym.name}`
                : gym.name;
              return (
                <TouchableOpacity key={gym.id} style={[styles.gymRow, selected && styles.gymRowSelected]} onPress={() => toggleGym(gym.id)}>
                  <View style={styles.gymInfo}>
                    <Text style={styles.gymName}>{displayName}</Text>
                    {gym.address && <Text style={styles.gymAddr}>{gym.address}</Text>}
                  </View>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                    size={24}
                    color={selected ? couleurs.accent : couleurs.texteFaible}
                  />
                </TouchableOpacity>
              );
            })}
          {gyms.filter((g) => !gymFilter || `${g.brand || ''} ${g.name}`.toLowerCase().includes(gymFilter.toLowerCase())).length > 4 && (
            <Text style={styles.moreHint}>
              {gyms.filter((g) => !gymFilter || `${g.brand || ''} ${g.name}`.toLowerCase().includes(gymFilter.toLowerCase())).length - 4} autres — affinez avec le filtre
            </Text>
          )}
        </View>
      )}

      {/* Lieux custom */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Lieux personnalisés</Text>
        {(data.customSpots || []).map((spot, idx) => (
          <View key={idx} style={styles.spotRow}>
            <Text style={styles.spotLabel}>{SPOT_TYPES.find(t => t.value === spot.type)?.icon} {spot.label}</Text>
            <TouchableOpacity onPress={() => removeSpot(idx)}>
              <Ionicons name="close-circle" size={22} color={couleurs.danger} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addSpotBtn} onPress={() => setShowSpotModal(true)}>
          <Ionicons name="add" size={18} color={couleurs.accent} />
          <Text style={styles.addSpotText}>Ajouter un lieu</Text>
        </TouchableOpacity>
      </View>

      <PrimaryButton label="Continuer" onPress={onNext} />

      {/* Modal ajout lieu */}
      <Modal visible={showSpotModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Ajouter un lieu</Text>
            <Text style={styles.sectionLabel}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.spotTypes}>
              {SPOT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.spotTypeBtn, newSpotType === t.value && styles.spotTypeBtnActive]}
                  onPress={() => setNewSpotType(t.value)}
                >
                  <Text>{t.icon}</Text>
                  <Text style={[styles.spotTypeTxt, newSpotType === t.value && styles.spotTypeTxtActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextField label="Nom du lieu" value={newSpotLabel} onChangeText={setNewSpotLabel} placeholder="Ex: Parc des Buttes-Chaumont" />
            <TextField label="Adresse" value={newSpotAddress} onChangeText={setNewSpotAddress} placeholder="Optionnelle" optional />
            <PrimaryButton label="Ajouter" onPress={addCustomSpot} />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSpotModal(false)}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: 8 },
  subtitle: { fontSize: 14, color: couleurs.texteDoux, marginBottom: 24, lineHeight: 20 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  searchInput: { flex: 1 },
  geoBtn: { padding: 12, backgroundColor: couleurs.accentVoile, borderRadius: 8, marginBottom: 16 },
  mapContainer: { height: 220, borderRadius: 12, overflow: 'hidden', marginVertical: 16 },
  map: { flex: 1 },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: couleurs.texte, marginBottom: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: couleurs.fond, borderRadius: 8, paddingHorizontal: 10, marginBottom: 10 },
  filterIcon: { marginRight: 6 },
  filterInput: { flex: 1, paddingVertical: 9, fontSize: 14, color: couleurs.texte },
  moreHint: { fontSize: 12, color: couleurs.texteFaible, textAlign: 'center', paddingVertical: 6 },
  gymRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: couleurs.carte, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: couleurs.bord },
  gymRowSelected: { borderColor: couleurs.accent, backgroundColor: couleurs.accentVoile },
  gymInfo: { flex: 1 },
  gymName: { fontSize: 14, fontWeight: '600', color: couleurs.texte },
  gymAddr: { fontSize: 12, color: couleurs.texteDoux, marginTop: 2 },
  spotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: couleurs.bord },
  spotLabel: { fontSize: 14, color: couleurs.texte },
  addSpotBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  addSpotText: { color: couleurs.accent, fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: couleurs.carte, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: couleurs.texte, marginBottom: 16 },
  spotTypes: { marginBottom: 16 },
  spotTypeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: couleurs.bord, marginRight: 8, alignItems: 'center' },
  spotTypeBtnActive: { borderColor: couleurs.accent, backgroundColor: couleurs.accentVoile },
  spotTypeTxt: { fontSize: 12, color: couleurs.texteDoux, marginTop: 2 },
  spotTypeTxtActive: { color: couleurs.accent, fontWeight: '600' },
  cancelBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  cancelTxt: { color: couleurs.texteDoux, fontSize: 14 },
});

export default Step2Location;
