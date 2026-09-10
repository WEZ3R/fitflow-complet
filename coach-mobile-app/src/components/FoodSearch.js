import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { foodAPI } from '../services/api';
import { couleurs } from '../theme';

const FoodSearch = ({ onSelect }) => {
  const [mode, setMode] = useState('search'); // 'search' | 'manual'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('100');

  // Saisie manuelle
  const [manualDescription, setManualDescription] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFats, setManualFats] = useState('');

  const debounceRef = useRef(null);

  const searchFood = useCallback(async (term) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await foodAPI.search(term);
      const products = response.data.data?.products || [];
      setResults(products);
    } catch (error) {
      console.error('Erreur recherche alimentaire:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value) => {
    setQuery(value);
    setSelectedProduct(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchFood(value), 400);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setQuery(product.name);
    setResults([]);
    setQuantity('100');
  };

  const calculateNutriments = () => {
    if (!selectedProduct) return null;
    const q = Number.isFinite(parseFloat(quantity)) ? parseFloat(quantity) : 0;
    return {
      calories: Math.round((selectedProduct.energyKcal100g / 100) * q),
      protein: Math.round(((selectedProduct.proteins100g / 100) * q) * 10) / 10,
      carbs: Math.round(((selectedProduct.carbohydrates100g / 100) * q) * 10) / 10,
      fats: Math.round(((selectedProduct.fat100g / 100) * q) * 10) / 10,
      fiber: Math.round(((selectedProduct.fiber100g / 100) * q) * 10) / 10,
    };
  };

  const handleAdd = () => {
    if (mode === 'manual') {
      if (!manualDescription || !manualCalories) return;
      onSelect({
        description: manualDescription,
        calories: parseInt(manualCalories) || 0,
        protein: parseFloat(manualProtein) || 0,
        carbs: parseFloat(manualCarbs) || 0,
        fats: parseFloat(manualFats) || 0,
      });
      setManualDescription('');
      setManualCalories('');
      setManualProtein('');
      setManualCarbs('');
      setManualFats('');
      return;
    }

    if (!selectedProduct) return;
    const calc = calculateNutriments();
    if (!calc) return;

    onSelect({
      description: `${selectedProduct.name} - ${quantity}g`,
      calories: calc.calories,
      protein: calc.protein,
      carbs: calc.carbs,
      fats: calc.fats,
    });

    // Reset
    setQuery('');
    setSelectedProduct(null);
    setQuantity('100');
    setResults([]);
  };

  const calc = calculateNutriments();

  if (mode === 'manual') {
    return (
      <View style={styles.container}>
        <View style={styles.modeHeader}>
          <Text style={styles.modeTitle}>Saisie manuelle</Text>
          <TouchableOpacity onPress={() => setMode('search')}>
            <Text style={styles.modeSwitch}>Rechercher</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Description de l'aliment"
          value={manualDescription}
          onChangeText={setManualDescription}
        />
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Calories (kcal)"
            value={manualCalories}
            onChangeText={setManualCalories}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Protéines (g)"
            value={manualProtein}
            onChangeText={setManualProtein}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Glucides (g)"
            value={manualCarbs}
            onChangeText={setManualCarbs}
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Lipides (g)"
            value={manualFats}
            onChangeText={setManualFats}
            keyboardType="decimal-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.addButton, (!manualDescription || !manualCalories) && styles.addButtonDisabled]}
          onPress={handleAdd}
          disabled={!manualDescription || !manualCalories}
        >
          <Text style={styles.addButtonText}>Valider</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.modeHeader}>
        <Text style={styles.modeTitle}>Rechercher un aliment</Text>
        <TouchableOpacity onPress={() => setMode('manual')}>
          <Text style={styles.modeSwitch}>Saisie manuelle</Text>
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={couleurs.texteFaible} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Ex : banane, poulet, riz..."
          value={query}
          onChangeText={handleQueryChange}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setSelectedProduct(null); setResults([]); }}>
            <Ionicons name="close-circle" size={20} color={couleurs.texteFaible} />
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <ActivityIndicator size="small" color={couleurs.accent} style={{ marginVertical: 8 }} />
      )}

      {/* Résultats */}
      {results.length > 0 && !selectedProduct && (
        <View style={styles.resultsContainer}>
          {results.slice(0, 8).map((product) => (
            <TouchableOpacity
              key={product.ciqualCode}
              style={styles.resultItem}
              onPress={() => handleSelectProduct(product)}
            >
              <View style={styles.resultInfo}>
                <Text style={styles.resultName} numberOfLines={1}>{product.name}</Text>
                {product.groupName && (
                  <Text style={styles.resultGroup} numberOfLines={1}>{product.groupName}</Text>
                )}
              </View>
              <Text style={styles.resultKcal}>{Math.round(product.energyKcal100g)} kcal</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Produit sélectionné */}
      {selectedProduct && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedName}>{selectedProduct.name}</Text>
          {selectedProduct.groupName && (
            <Text style={styles.selectedGroup}>{selectedProduct.groupName}</Text>
          )}

          <View style={styles.quantityRow}>
            <Text style={styles.quantityLabel}>Quantité (g)</Text>
            <TextInput
              style={styles.quantityInput}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>

          {calc && (
            <View style={styles.macrosRow}>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: couleurs.danger }]}>{calc.calories}</Text>
                <Text style={styles.macroLabel}>kcal</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: couleurs.info }]}>{calc.protein}g</Text>
                <Text style={styles.macroLabel}>Prot.</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: couleurs.alerte }]}>{calc.carbs}g</Text>
                <Text style={styles.macroLabel}>Gluc.</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: couleurs.alerte }]}>{calc.fats}g</Text>
                <Text style={styles.macroLabel}>Lip.</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={[styles.macroValue, { color: couleurs.succes }]}>{calc.fiber}g</Text>
                <Text style={styles.macroLabel}>Fibres</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Valider</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  modeSwitch: {
    fontSize: 13,
    color: couleurs.accent,
    fontWeight: '500',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: couleurs.texte,
  },
  input: {
    backgroundColor: couleurs.fond,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: couleurs.texte,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    color: couleurs.texte,
    flex: 1,
  },
  resultsContainer: {
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    maxHeight: 260,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bord,
  },
  resultInfo: {
    flex: 1,
    marginRight: 8,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: couleurs.texte,
  },
  resultGroup: {
    fontSize: 12,
    color: couleurs.texteFaible,
    marginTop: 1,
  },
  resultKcal: {
    fontSize: 12,
    fontWeight: '600',
    color: couleurs.texteFaible,
  },
  selectedContainer: {
    backgroundColor: couleurs.fond,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '600',
    color: couleurs.texte,
  },
  selectedGroup: {
    fontSize: 13,
    color: couleurs.texteFaible,
    marginTop: -6,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: couleurs.texteDoux,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: couleurs.carte,
    borderWidth: 1,
    borderColor: couleurs.bord,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: couleurs.texte,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
    backgroundColor: couleurs.carte,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.bord,
    paddingVertical: 8,
    paddingHorizontal: 6,
    flex: 1,
    marginHorizontal: 2,
  },
  macroValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  macroLabel: {
    fontSize: 10,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
  addButton: {
    backgroundColor: couleurs.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: couleurs.eleve,
  },
  addButtonText: {
    color: couleurs.accentEncre,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default FoodSearch;
