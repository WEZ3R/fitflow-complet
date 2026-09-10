"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { foodAPI } from "@/lib/api";
import { Search, X } from "lucide-react";
import type { FoodProduct } from "@/types";

interface FoodSearchProps {
  onSelect: (food: {
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }) => void;
}

export const FoodSearch = ({ onSelect }: FoodSearchProps) => {
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  const [quantity, setQuantity] = useState("100");

  // Saisie manuelle
  const [manualDescription, setManualDescription] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFats, setManualFats] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fermer le dropdown en cliquant à l'extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchFood = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const response = await foodAPI.search(term);
      const products = response.data.data?.products || [];
      setResults(products);
      setShowDropdown(products.length > 0);
    } catch (error) {
      console.error("Erreur recherche alimentaire:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedProduct(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchFood(value), 400);
  };

  const handleSelectProduct = (product: FoodProduct) => {
    setSelectedProduct(product);
    setQuery(product.name);
    setShowDropdown(false);
    setQuantity("100");
  };

  const calculateNutriments = () => {
    if (!selectedProduct) return null;
    const q = parseFloat(quantity) || 0;
    return {
      calories: Math.round((selectedProduct.energyKcal100g / 100) * q),
      protein: Math.round(((selectedProduct.proteins100g / 100) * q) * 10) / 10,
      carbs: Math.round(((selectedProduct.carbohydrates100g / 100) * q) * 10) / 10,
      fats: Math.round(((selectedProduct.fat100g / 100) * q) * 10) / 10,
      fiber: Math.round(((selectedProduct.fiber100g / 100) * q) * 10) / 10,
    };
  };

  const handleAdd = () => {
    if (mode === "manual") {
      if (!manualDescription || !manualCalories) return;
      onSelect({
        description: manualDescription,
        calories: parseInt(manualCalories) || 0,
        protein: parseFloat(manualProtein) || 0,
        carbs: parseFloat(manualCarbs) || 0,
        fats: parseFloat(manualFats) || 0,
      });
      setManualDescription("");
      setManualCalories("");
      setManualProtein("");
      setManualCarbs("");
      setManualFats("");
      return;
    }

    if (!selectedProduct) return;
    const calc = calculateNutriments();
    if (!calc) return;

    const description = `${selectedProduct.name} - ${quantity}g`;
    onSelect({
      description,
      calories: calc.calories,
      protein: calc.protein,
      carbs: calc.carbs,
      fats: calc.fats,
    });

    // Reset
    setQuery("");
    setSelectedProduct(null);
    setQuantity("100");
    setResults([]);
  };

  const calc = calculateNutriments();

  if (mode === "manual") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Saisie manuelle</span>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="text-sm text-primary-600 hover:underline"
          >
            Rechercher un aliment
          </button>
        </div>
        <Input
          placeholder="Description du repas"
          value={manualDescription}
          onChange={(e) => setManualDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Calories (kcal)"
            value={manualCalories}
            onChange={(e) => setManualCalories(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Protéines (g)"
            value={manualProtein}
            onChange={(e) => setManualProtein(e.target.value)}
            step="0.1"
          />
          <Input
            type="number"
            placeholder="Glucides (g)"
            value={manualCarbs}
            onChange={(e) => setManualCarbs(e.target.value)}
            step="0.1"
          />
          <Input
            type="number"
            placeholder="Lipides (g)"
            value={manualFats}
            onChange={(e) => setManualFats(e.target.value)}
            step="0.1"
          />
        </div>
        <Button
          type="button"
          onClick={handleAdd}
          variant="secondary"
          className="w-full"
          disabled={!manualDescription || !manualCalories}
        >
          Valider
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Rechercher un aliment</span>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className="text-sm text-primary-600 hover:underline"
        >
          Saisie manuelle
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && !selectedProduct && setShowDropdown(true)}
            placeholder="Ex : banane, poulet grillé, riz basmati..."
            className="input pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedProduct(null);
                setResults([]);
                setShowDropdown(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading && (
          <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-white border rounded-lg shadow-lg z-10 text-center text-sm text-gray-500">
            Recherche en cours...
          </div>
        )}

        {/* Dropdown résultats */}
        {showDropdown && !loading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-80 overflow-y-auto">
            {results.map((product) => (
              <button
                key={product.ciqualCode}
                type="button"
                onClick={() => handleSelectProduct(product)}
                className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  {product.groupName && (
                    <p className="text-xs text-gray-500 truncate">{product.groupName}</p>
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-600 flex-shrink-0">
                  {Math.round(product.energyKcal100g)} kcal/100g
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Produit sélectionné : quantité + macros */}
      {selectedProduct && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <div>
            <p className="font-medium text-gray-900">{selectedProduct.name}</p>
            {selectedProduct.groupName && (
              <p className="text-sm text-gray-500">{selectedProduct.groupName}</p>
            )}
          </div>

          <Input
            label="Quantité (grammes)"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            step="1"
          />

          {calc && (
            <div className="grid grid-cols-5 gap-2 text-center">
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-red-600">{calc.calories}</p>
                <p className="text-xs text-gray-500">kcal</p>
              </div>
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-blue-600">{calc.protein}g</p>
                <p className="text-xs text-gray-500">Prot.</p>
              </div>
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-yellow-600">{calc.carbs}g</p>
                <p className="text-xs text-gray-500">Gluc.</p>
              </div>
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-orange-600">{calc.fats}g</p>
                <p className="text-xs text-gray-500">Lip.</p>
              </div>
              <div className="p-2 bg-white rounded border">
                <p className="text-lg font-bold text-green-600">{calc.fiber}g</p>
                <p className="text-xs text-gray-500">Fibres</p>
              </div>
            </div>
          )}

          <Button
            type="button"
            onClick={handleAdd}
            variant="secondary"
            className="w-full"
          >
            Valider
          </Button>
        </div>
      )}
    </div>
  );
};
