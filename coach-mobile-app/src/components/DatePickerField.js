import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { format, parse, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { couleurs } from '../theme';

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Convertit une chaîne ISO "YYYY-MM-DD" en objet Date (midi pour éviter
 * les décalages de fuseau horaire).
 */
const isoToDate = (isoStr) => {
  if (!isoStr) return new Date();
  try {
    const d = new Date(isoStr + 'T12:00:00');
    return isValid(d) ? d : new Date();
  } catch {
    return new Date();
  }
};

/**
 * Convertit un objet Date en chaîne ISO "YYYY-MM-DD".
 */
const dateToIso = (date) => format(date, 'yyyy-MM-dd');

/**
 * Formate une chaîne ISO "YYYY-MM-DD" en "JJ/MM/AAAA" pour l'affichage.
 */
const isoToDisplay = (isoStr) => {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr + 'T12:00:00');
    return isValid(d) ? format(d, 'dd/MM/yyyy') : null;
  } catch {
    return null;
  }
};

// -----------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------

/**
 * Champ sélecteur de date.
 *
 * Props :
 *   value       — chaîne ISO "YYYY-MM-DD" (ou "")
 *   onChange    — callback(isoString: string)
 *   label       — label affiché au-dessus
 *   placeholder — texte si vide (défaut : "JJ/MM/AAAA")
 *   minimumDate — Date JS (optionnel)
 *   maximumDate — Date JS (optionnel)
 *   style       — style supplémentaire pour le wrapper
 */
const DatePickerField = ({
  value,
  onChange,
  label,
  placeholder = 'JJ/MM/AAAA',
  minimumDate,
  maximumDate,
  style,
  error,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const currentDate = isoToDate(value);
  const displayValue = isoToDisplay(value);

  const handleChange = (event, selectedDate) => {
    // Android : ferme le picker automatiquement
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'dismissed') return;
    }
    if (selectedDate) {
      onChange(dateToIso(selectedDate));
    }
  };

  // ─── iOS : picker dans une modal bottom-sheet ─────────────────────
  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.wrapper, style]}>
        {label && <Text style={styles.label}>{label}</Text>}

        <TouchableOpacity
          style={[styles.button, !value && styles.buttonEmpty, error && styles.buttonError]}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="calendar-outline"
            size={16}
            color={error ? couleurs.danger : value ? couleurs.accent : couleurs.texteFaible}
            style={styles.icon}
          />
          <Text style={[styles.buttonText, !value && styles.buttonTextEmpty]}>
            {displayValue || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={14} color={couleurs.texteFaible} />
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Modal bottom-sheet iOS */}
        <Modal
          visible={showPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowPicker(false)}
        >
          <TouchableOpacity
            style={styles.iosOverlay}
            activeOpacity={1}
            onPress={() => setShowPicker(false)}
          />
          <View style={styles.iosSheet}>
            <View style={styles.iosSheetHeader}>
              <Text style={styles.iosSheetTitle}>{label || 'Sélectionner une date'}</Text>
              <TouchableOpacity
                onPress={() => setShowPicker(false)}
                style={styles.iosConfirmBtn}
              >
                <Text style={styles.iosConfirmText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              mode="date"
              value={currentDate}
              onChange={handleChange}
              display="spinner"
              locale="fr-FR"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              style={styles.iosPicker}
            />
          </View>
        </Modal>
      </View>
    );
  }

  // ─── Android : picker natif (dialog) ─────────────────────────────
  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.button, !value && styles.buttonEmpty, error && styles.buttonError]}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="calendar-outline"
          size={16}
          color={error ? couleurs.danger : value ? couleurs.accent : couleurs.texteFaible}
          style={styles.icon}
        />
        <Text style={[styles.buttonText, !value && styles.buttonTextEmpty]}>
          {displayValue || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={couleurs.texteFaible} />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      {showPicker && (
        <DateTimePicker
          mode="date"
          value={currentDate}
          onChange={handleChange}
          display="default"
          locale="fr-FR"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  buttonEmpty: {
    borderColor: couleurs.bord,
  },
  buttonError: {
    borderColor: couleurs.danger,
    backgroundColor: couleurs.dangerVoile,
  },
  errorText: {
    fontSize: 12,
    color: couleurs.danger,
    marginTop: 4,
  },
  icon: {
    marginRight: 8,
  },
  buttonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texte,
  },
  buttonTextEmpty: {
    color: couleurs.texteFaible,
    fontWeight: '400',
  },
  // iOS modal
  iosOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  iosSheet: {
    backgroundColor: couleurs.carte,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  iosSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  iosSheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: couleurs.texte,
  },
  iosConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: couleurs.accent,
    borderRadius: 8,
  },
  iosConfirmText: {
    color: couleurs.accentEncre,
    fontSize: 14,
    fontWeight: '700',
  },
  iosPicker: {
    height: 200,
  },
});

export default DatePickerField;
