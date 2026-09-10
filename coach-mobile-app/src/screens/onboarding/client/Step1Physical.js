import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import SelectCard from '../../../components/SelectCard';
import PrimaryButton from '../../../components/PrimaryButton';
import { couleurs } from '../../../theme';

const GENRES = [
  { value: 'M', label: 'Homme', icon: '♂️' },
  { value: 'F', label: 'Femme', icon: '♀️' },
  { value: 'X', label: 'Autre', icon: '⚧️' },
];

const MIN_HEIGHT = 130;
const MAX_HEIGHT = 220;
const DEFAULT_HEIGHT = 170;

const formatDate = (date) => {
  if (!date) return null;
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const Step1Physical = ({ data, onChange, onNext }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const heightValue = parseInt(data.height) || DEFAULT_HEIGHT;

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) onChange({ dateOfBirth: selectedDate });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Parlez-nous de vous</Text>
      <Text style={styles.subtitle}>Ces informations nous permettent de personnaliser votre expérience.</Text>

      {/* Genre — facultatif */}
      <Text style={styles.sectionLabel}>Genre <Text style={styles.optional}>(facultatif)</Text></Text>
      <View style={styles.row}>
        {GENRES.map((g) => (
          <SelectCard
            key={g.value}
            label={g.label}
            icon={g.icon}
            selected={data.gender === g.value}
            onPress={() => onChange({ gender: data.gender === g.value ? null : g.value })}
          />
        ))}
      </View>

      {/* Date de naissance */}
      <Text style={styles.sectionLabel}>Date de naissance <Text style={styles.optional}>(facultatif)</Text></Text>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
        <Text style={data.dateOfBirth ? styles.dateTxt : styles.datePlaceholder}>
          {data.dateOfBirth ? formatDate(data.dateOfBirth) : 'JJ/MM/AAAA'}
        </Text>
      </TouchableOpacity>
      {(showDatePicker || Platform.OS === 'ios') && (
        <DateTimePicker
          mode="date"
          value={data.dateOfBirth || new Date(2000, 0, 1)}
          maximumDate={new Date()}
          minimumDate={new Date(1924, 0, 1)}
          onChange={onDateChange}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          locale="fr-FR"
        />
      )}

      {/* Taille — slider + input */}
      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Taille <Text style={styles.optional}>(facultatif)</Text></Text>
      <View style={styles.sliderRow}>
        <Slider
          style={styles.slider}
          value={heightValue}
          minimumValue={MIN_HEIGHT}
          maximumValue={MAX_HEIGHT}
          step={1}
          minimumTrackTintColor={couleurs.accent}
          maximumTrackTintColor={couleurs.bordFort}
          thumbTintColor={couleurs.accent}
          onValueChange={(v) => onChange({ height: String(v) })}
        />
        <View style={styles.heightInputWrap}>
          <TextInput
            style={styles.heightInput}
            value={data.height}
            onChangeText={(v) => {
              const n = parseInt(v);
              if (v === '' || (n >= MIN_HEIGHT && n <= MAX_HEIGHT)) onChange({ height: v });
            }}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.heightUnit}>cm</Text>
        </View>
      </View>

      {/* Poids */}
      <Text style={[styles.sectionLabel, { marginTop: 4 }]}>Poids <Text style={styles.optional}>(facultatif)</Text></Text>
      <View style={styles.weightRow}>
        <TextInput
          style={styles.weightInput}
          value={data.weight}
          onChangeText={(v) => onChange({ weight: v })}
          keyboardType="decimal-pad"
          placeholder="Ex: 70"
          placeholderTextColor={couleurs.texteFaible}
        />
        <Text style={styles.heightUnit}>kg</Text>
      </View>

      <PrimaryButton label="Continuer" onPress={onNext} style={{ marginTop: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingTop: 8, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: couleurs.texte, marginBottom: 8 },
  subtitle: { fontSize: 14, color: couleurs.texteDoux, marginBottom: 24, lineHeight: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '500', color: couleurs.texte, marginBottom: 8 },
  optional: { color: couleurs.texteDoux, fontWeight: '400' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  dateBtn: {
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: couleurs.carte,
    marginBottom: 4,
  },
  dateTxt: { fontSize: 15, color: couleurs.texte },
  datePlaceholder: { fontSize: 15, color: couleurs.texteFaible },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  slider: { flex: 1 },
  heightInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heightInput: {
    width: 52,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 15,
    color: couleurs.texte,
    backgroundColor: couleurs.carte,
  },
  heightUnit: { fontSize: 14, color: couleurs.texteDoux, fontWeight: '500' },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: couleurs.texte,
    backgroundColor: couleurs.carte,
  },
});

export default Step1Physical;
