import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nutritionAPI } from '../services/api';
import { couleurs } from '../theme';

// -----------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------

const ACTIVITY_PRESETS = [
  { value: 1.2,  label: 'Sédentaire',   detail: 'Peu ou pas d\'exercice' },
  { value: 1.37, label: 'Légère',        detail: '1–3 séances / semaine' },
  { value: 1.55, label: 'Modérée',       detail: '3–5 séances / semaine' },
  { value: 1.72, label: 'Intense',       detail: '6–7 séances / semaine' },
  { value: 1.9,  label: 'Très intense',  detail: '2× / jour' },
];

const OBJECTIVES = [
  { key: 'maintien',       label: 'Maintien',        color: couleurs.info },
  { key: 'prise_de_masse', label: 'Prise de masse',  color: couleurs.succes },
  { key: 'seche',          label: 'Sèche',            color: couleurs.alerte },
];

// -----------------------------------------------------------------------
// Composant
// -----------------------------------------------------------------------

/**
 * Calculateur de calories dynamique basé sur le profil client.
 *
 * Props :
 *   clientId  — ID du client (obligatoire)
 *   onApply   — callback(targetCalories: string) appelé quand le coach applique
 */
const CalorieCalculator = ({ clientId, onApply }) => {
  const [expanded, setExpanded]       = useState(false);
  const [objective, setObjective]     = useState('maintien');
  const [activityFactor, setActivity] = useState(1.55);
  const [surplus, setSurplus]         = useState('300');
  const [deficit, setDeficit]         = useState('400');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);

  const objColor = OBJECTIVES.find((o) => o.key === objective)?.color ?? couleurs.accent;

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = { clientId, activityFactor, objective };
      if (objective === 'prise_de_masse' && surplus) payload.surplus = parseInt(surplus, 10);
      if (objective === 'seche'          && deficit)  payload.deficit = parseInt(deficit, 10);

      const response = await nutritionAPI.calculate(payload);
      setResult(response.data.data);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        'Impossible de calculer. Vérifiez que le profil client est complet (poids, taille, date de naissance, sexe).'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(String(result.calories_cible));
      setExpanded(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Bouton d'expansion */}
      <TouchableOpacity
        style={styles.toggleBtn}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons name="calculator-outline" size={14} color={couleurs.accent} />
        <Text style={styles.toggleText}>Calculer automatiquement</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={couleurs.accent} />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.panel}>

          {/* ── Objectif ── */}
          <Text style={styles.panelLabel}>Objectif</Text>
          <View style={styles.objRow}>
            {OBJECTIVES.map((obj) => (
              <TouchableOpacity
                key={obj.key}
                style={[
                  styles.objBtn,
                  objective === obj.key && { backgroundColor: obj.color, borderColor: obj.color },
                ]}
                onPress={() => setObjective(obj.key)}
              >
                <Text style={[styles.objBtnText, objective === obj.key && styles.objBtnTextActive]}>
                  {obj.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Delta calorique ── */}
          {objective === 'prise_de_masse' && (
            <View style={styles.deltaRow}>
              <Text style={styles.panelLabel}>Surplus calorique (kcal)</Text>
              <TextInput
                style={styles.deltaInput}
                value={surplus}
                onChangeText={setSurplus}
                keyboardType="number-pad"
                placeholder="300"
                placeholderTextColor={couleurs.texteFaible}
              />
            </View>
          )}
          {objective === 'seche' && (
            <View style={styles.deltaRow}>
              <Text style={styles.panelLabel}>Déficit calorique (kcal)</Text>
              <TextInput
                style={styles.deltaInput}
                value={deficit}
                onChangeText={setDeficit}
                keyboardType="number-pad"
                placeholder="400"
                placeholderTextColor={couleurs.texteFaible}
              />
            </View>
          )}

          {/* ── Niveau d'activité ── */}
          <Text style={[styles.panelLabel, { marginTop: 12 }]}>Niveau d'activité</Text>
          {ACTIVITY_PRESETS.map((preset) => {
            const active = activityFactor === preset.value;
            return (
              <TouchableOpacity
                key={preset.value}
                style={[styles.activityBtn, active && styles.activityBtnActive]}
                onPress={() => setActivity(preset.value)}
              >
                <View style={styles.activityBtnLeft}>
                  <Text style={[styles.activityBtnLabel, active && styles.activityBtnLabelActive]}>
                    {preset.label}
                  </Text>
                  <Text style={styles.activityBtnDetail}>{preset.detail}</Text>
                </View>
                <Text style={[styles.activityBtnFactor, active && styles.activityBtnFactorActive]}>
                  ×{preset.value}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* ── Bouton calculer ── */}
          <TouchableOpacity
            style={[styles.calcBtn, loading && styles.calcBtnDisabled]}
            onPress={handleCalculate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={couleurs.accentEncre} />
            ) : (
              <>
                <Ionicons name="flash" size={14} color={couleurs.accentEncre} />
                <Text style={styles.calcBtnText}>Calculer</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ── Erreur ── */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color={couleurs.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Résultats ── */}
          {result && (
            <View style={styles.resultBox}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>BMR (repos)</Text>
                <Text style={styles.resultValue}>{result.bmr} kcal</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>TDEE (activité)</Text>
                <Text style={styles.resultValue}>{result.tdee} kcal</Text>
              </View>

              <View style={[styles.resultHighlight, { borderColor: objColor + '44' }]}>
                <Text style={styles.resultHighlightLabel}>Objectif calorique</Text>
                <Text style={[styles.resultHighlightValue, { color: objColor }]}>
                  {result.calories_cible} kcal
                </Text>
              </View>

              {result.delta !== 0 && (
                <Text style={styles.deltaText}>
                  {result.delta > 0 ? '+' : ''}{result.delta} kcal vs TDEE
                </Text>
              )}

              {/* Macros */}
              <Text style={styles.macrosTitle}>Macronutriments</Text>
              <View style={styles.macroRow}>
                <View style={[styles.macroDot, { backgroundColor: couleurs.accent }]} />
                <Text style={styles.macroLabel}>Protéines</Text>
                <Text style={styles.macroValue}>{result.macronutriments.proteines} g</Text>
              </View>
              <View style={styles.macroRow}>
                <View style={[styles.macroDot, { backgroundColor: couleurs.alerte }]} />
                <Text style={styles.macroLabel}>Lipides</Text>
                <Text style={styles.macroValue}>{result.macronutriments.lipides} g</Text>
              </View>
              <View style={styles.macroRow}>
                <View style={[styles.macroDot, { backgroundColor: couleurs.succes }]} />
                <Text style={styles.macroLabel}>Glucides</Text>
                <Text style={styles.macroValue}>{result.macronutriments.glucides} g</Text>
              </View>

              {/* Barre proportionnelle */}
              <View style={styles.macroBar}>
                <View style={[styles.macroBarSegment, {
                  flex: result.macronutriments.proteines * 4,
                  backgroundColor: couleurs.accent,
                }]} />
                <View style={[styles.macroBarSegment, {
                  flex: result.macronutriments.lipides * 9,
                  backgroundColor: couleurs.alerte,
                }]} />
                <View style={[styles.macroBarSegment, {
                  flex: result.macronutriments.glucides * 4,
                  backgroundColor: couleurs.succes,
                }]} />
              </View>

              {/* Bouton appliquer */}
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: objColor }]}
                onPress={handleApply}
              >
                <Ionicons name="checkmark" size={15} color={couleurs.accentEncre} />
                <Text style={styles.applyBtnText}>
                  Appliquer {result.calories_cible} kcal
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  toggleText: {
    flex: 1,
    fontSize: 12,
    color: couleurs.accent,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: couleurs.fond,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: couleurs.bord,
    marginTop: 6,
  },
  // Objectif
  panelLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginBottom: 8,
  },
  objRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  objBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: couleurs.bord,
    alignItems: 'center',
  },
  objBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: couleurs.texteFaible,
  },
  objBtnTextActive: {
    color: couleurs.accentEncre,
  },
  // Delta
  deltaRow: {
    marginBottom: 12,
  },
  deltaInput: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: couleurs.texte,
    maxWidth: 120,
  },
  // Activité
  activityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
    marginBottom: 6,
    backgroundColor: couleurs.carte,
  },
  activityBtnActive: {
    borderColor: couleurs.accent,
    backgroundColor: couleurs.accentVoile,
  },
  activityBtnLeft: {
    flex: 1,
  },
  activityBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  activityBtnLabelActive: {
    color: couleurs.accent,
  },
  activityBtnDetail: {
    fontSize: 11,
    color: couleurs.texteFaible,
    marginTop: 1,
  },
  activityBtnFactor: {
    fontSize: 12,
    fontWeight: '700',
    color: couleurs.texteFaible,
  },
  activityBtnFactorActive: {
    color: couleurs.accent,
  },
  // Bouton calculer
  calcBtn: {
    backgroundColor: couleurs.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  calcBtnDisabled: {
    opacity: 0.6,
  },
  calcBtnText: {
    color: couleurs.accentEncre,
    fontSize: 13,
    fontWeight: '700',
  },
  // Erreur
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: couleurs.dangerVoile,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: couleurs.danger,
  },
  // Résultats
  resultBox: {
    marginTop: 12,
    backgroundColor: couleurs.carte,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: couleurs.bord,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  resultLabel: {
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  resultValue: {
    fontSize: 12,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  resultHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  resultHighlightLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: couleurs.texte,
  },
  resultHighlightValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  deltaText: {
    fontSize: 11,
    color: couleurs.texteFaible,
    textAlign: 'right',
    marginBottom: 8,
  },
  // Macros
  macrosTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: couleurs.texteDoux,
    marginTop: 8,
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  macroLabel: {
    flex: 1,
    fontSize: 12,
    color: couleurs.texteFaible,
  },
  macroValue: {
    fontSize: 12,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  macroBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 12,
  },
  macroBarSegment: {
    height: 6,
  },
  // Bouton appliquer
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  applyBtnText: {
    color: couleurs.accentEncre,
    fontSize: 13,
    fontWeight: '700',
  },
});

export default CalorieCalculator;
