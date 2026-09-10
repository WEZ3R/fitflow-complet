/**
 * Tests unitaires : parseSetData.js
 * Couvre : parseNumericField, estimate1RM, getISOWeek
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumericField, estimate1RM, getISOWeek } from '../src/utils/parseSetData.js';

// ─── parseNumericField ────────────────────────────────────────────────────────

describe('parseNumericField', () => {
  // Valeurs vides / nulles
  test('null → null', () => assert.equal(parseNumericField(null), null));
  test('undefined → null', () => assert.equal(parseNumericField(undefined), null));
  test('"" → null', () => assert.equal(parseNumericField(''), null));
  test('"  " → null', () => assert.equal(parseNumericField('   '), null));

  // Valeurs non numériques
  test('"AMRAP" → null', () => assert.equal(parseNumericField('AMRAP'), null));
  test('"MAX" → null', () => assert.equal(parseNumericField('MAX'), null));
  test('"echec" → null', () => assert.equal(parseNumericField('echec'), null));

  // Nombres simples
  test('"80" → 80', () => assert.equal(parseNumericField('80'), 80));
  test('"80.5" → 80.5', () => assert.equal(parseNumericField('80.5'), 80.5));
  test('"12" → 12', () => assert.equal(parseNumericField('12'), 12));

  // Poids avec unité
  test('"80kg" → 80', () => assert.equal(parseNumericField('80kg'), 80));
  test('"80 kg" → 80', () => assert.equal(parseNumericField('80 kg'), 80));
  test('"100lbs" → 100', () => assert.equal(parseNumericField('100lbs'), 100));
  test('"100lb" → 100', () => assert.equal(parseNumericField('100lb'), 100));

  // Zéro → null (pas de sens pour poids/reps)
  test('"0" → null', () => assert.equal(parseNumericField('0'), null));
  test('"0kg" → null', () => assert.equal(parseNumericField('0kg'), null));

  // Plages — strategy high (défaut)
  test('"12-15" → 15 (high)', () => assert.equal(parseNumericField('12-15'), 15));
  test('"12-15" + high → 15', () => assert.equal(parseNumericField('12-15', 'high'), 15));
  test('"12-15" + low → 12', () => assert.equal(parseNumericField('12-15', 'low'), 12));
  test('"12-15" + avg → 13.5', () => assert.equal(parseNumericField('12-15', 'avg'), 13.5));

  // Plage avec tiret long (–)
  test('"8–12" → 12 (high)', () => assert.equal(parseNumericField('8–12'), 12));
  test('"8–12" + low → 8', () => assert.equal(parseNumericField('8–12', 'low'), 8));
});

// ─── estimate1RM ─────────────────────────────────────────────────────────────

describe('estimate1RM', () => {
  // Valeurs invalides
  test('(null, 5) → null', () => assert.equal(estimate1RM(null, 5), null));
  test('(80, null) → null', () => assert.equal(estimate1RM(80, null), null));
  test('(null, null) → null', () => assert.equal(estimate1RM(null, null), null));
  test('(0, 5) → null', () => assert.equal(estimate1RM(0, 5), null));
  test('(80, 0) → null', () => assert.equal(estimate1RM(80, 0), null));
  test('(-10, 5) → null', () => assert.equal(estimate1RM(-10, 5), null));

  // 1 rep = poids direct
  test('(100, 1) → 100', () => assert.equal(estimate1RM(100, 1), 100));
  test('(75, 1) → 75', () => assert.equal(estimate1RM(75, 1), 75));

  // Brzycki (2-10 reps) : weight * 36 / (37 - reps)
  test('(80, 10) → Brzycki arrondi 0.5', () => {
    const result = estimate1RM(80, 10);
    // 80 * 36 / 27 = 106.67 → arrondi à 106.5
    assert.equal(result, 106.5);
  });

  test('(100, 5) → Brzycki arrondi 0.5', () => {
    const result = estimate1RM(100, 5);
    // 100 * 36 / 32 = 112.5 → arrondi à 112.5
    assert.equal(result, 112.5);
  });

  test('(60, 2) → Brzycki arrondi 0.5', () => {
    const result = estimate1RM(60, 2);
    // 60 * 36 / 35 = 61.71... → arrondi à 61.5
    assert.equal(result, 61.5);
  });

  // Epley (> 10 reps) : weight * (1 + reps/30)
  test('(60, 15) → Epley 90', () => {
    const result = estimate1RM(60, 15);
    // 60 * (1 + 15/30) = 60 * 1.5 = 90
    assert.equal(result, 90);
  });

  test('(50, 20) → Epley arrondi 0.5', () => {
    const result = estimate1RM(50, 20);
    // 50 * (1 + 20/30) = 50 * 1.667 = 83.33 → arrondi à 83.5
    assert.equal(result, 83.5);
  });

  // Arrondi à 0.5 kg
  test('résultat arrondi à 0.5 kg', () => {
    const result = estimate1RM(70, 8);
    // 70 * 36 / 29 = 86.9 → 87.0
    assert.equal(result % 0.5, 0);
  });
});

// ─── getISOWeek ───────────────────────────────────────────────────────────────

describe('getISOWeek', () => {
  test('format YYYY-Www', () => {
    const week = getISOWeek(new Date('2026-01-01'));
    assert.match(week, /^\d{4}-W\d{2}$/);
  });

  test('2026-01-01 → 2026-W01', () => {
    assert.equal(getISOWeek(new Date('2026-01-01')), '2026-W01');
  });

  test('2025-12-31 → 2026-W01 (fin d\'année dans la semaine suivante)', () => {
    // Le 31 décembre 2025 est un mercredi → appartient à W01 de 2026
    assert.equal(getISOWeek(new Date('2025-12-31')), '2026-W01');
  });

  test('2026-03-30 → 2026-W14', () => {
    assert.equal(getISOWeek(new Date('2026-03-30')), '2026-W14');
  });

  test('accepte une chaîne ISO', () => {
    const week = getISOWeek('2026-06-15T10:00:00Z');
    assert.match(week, /^\d{4}-W\d{2}$/);
  });

  test('semaines numérotées sur 2 chiffres', () => {
    const week = getISOWeek(new Date('2026-03-02'));
    // W09 et non W9
    assert.match(week, /W\d{2}/);
  });
});
