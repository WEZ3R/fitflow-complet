import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StepProgress from '../../../components/StepProgress';
import Step1Physical from './Step1Physical';
import Step2Location from './Step2Location';
import Step3Goal from './Step3Goal';
import { onboardingAPI } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { couleurs } from '../../../theme';

const TOTAL_STEPS = 3;

const ClientOnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { updateUser } = useAuth();

  // Payload accumulé à travers les étapes
  const [step1Data, setStep1Data] = useState({ gender: null, dateOfBirth: null, height: '', weight: '' });
  const [step2Data, setStep2Data] = useState({ city: '', gymIds: [], customSpots: [] });
  const [step3Data, setStep3Data] = useState({ goalCategory: null, customGoal: '', level: null });

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => {
    if (step === 1) return;
    setStep((s) => s - 1);
  };

  const handleSkip = () => {
    // Passer tout l'onboarding — redirection directe
    navigation.replace('Main');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await onboardingAPI.submitClient({
        step1: step1Data,
        step2: step2Data,
        step3: step3Data,
      });
      // Mettre à jour le user dans le contexte avec onboardingCompletedAt
      if (res.data?.data && updateUser) {
        updateUser({ onboardingCompletedAt: res.data.data.onboardingCompletedAt });
      }
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Erreur', "Impossible de sauvegarder votre profil. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={[styles.headerBtn, step === 1 && styles.hidden]}>
          <Ionicons name="arrow-back" size={22} color={couleurs.texte} />
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <StepProgress total={TOTAL_STEPS} current={step} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.headerBtn}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Étapes */}
      {step === 1 && (
        <Step1Physical
          data={step1Data}
          onChange={(partial) => setStep1Data((d) => ({ ...d, ...partial }))}
          onNext={goNext}
        />
      )}
      {step === 2 && (
        <Step2Location
          data={step2Data}
          onChange={(partial) => setStep2Data((d) => ({ ...d, ...partial }))}
          onNext={goNext}
        />
      )}
      {step === 3 && (
        <Step3Goal
          data={step3Data}
          onChange={(partial) => setStep3Data((d) => ({ ...d, ...partial }))}
          onSubmit={handleSubmit}
          loading={loading}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: couleurs.fond },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  headerBtn: { padding: 10, width: 60, alignItems: 'center' },
  progressWrap: { flex: 1, paddingHorizontal: 4 },
  hidden: { opacity: 0 },
  skipText: { color: couleurs.texteDoux, fontSize: 14, fontWeight: '500' },
});

export default ClientOnboardingScreen;
