'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { exerciseRefsAPI } from '@/lib/api';
import { Search, X, Loader2 } from 'lucide-react';
import type { ExerciseReference } from '@/types';

interface ExerciseSearchProps {
  value: string;
  onSelect: (exercise: ExerciseReference) => void;
  onChange: (name: string) => void;
  placeholder?: string;
}

export default function ExerciseSearch({ value, onSelect, onChange, placeholder }: ExerciseSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ExerciseReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Recalcule la position du dropdown sous l'input (utilisé par le portal)
  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapperRef.current) return;
    const rect = inputWrapperRef.current.getBoundingClientRect();
    setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  // Sync avec la valeur externe
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fermer le dropdown au clic extérieur (en tenant compte du portal)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideInput = dropdownRef.current?.contains(target);
      const insidePortal = portalRef.current?.contains(target);
      if (!insideInput && !insidePortal) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recalculer la position lors du scroll/resize quand le dropdown est ouvert
  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true); // capture pour les scroll containers parents
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [showDropdown, updateDropdownPosition]);

  const searchExercises = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const response = await exerciseRefsAPI.search(term, 50);
      const exercises = response.data.data?.exercises || [];
      setResults(exercises);
      setShowDropdown(exercises.length > 0);
    } catch (error) {
      console.error('Erreur recherche exercices:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (newValue: string) => {
    setQuery(newValue);
    onChange(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchExercises(newValue), 400);
  };

  const handleSelectExercise = (exercise: ExerciseReference) => {
    setQuery(exercise.name);
    setShowDropdown(false);
    setResults([]);
    onSelect(exercise);
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setResults([]);
    setShowDropdown(false);
  };

  // Les équipements sont déjà en français dans la BDD FitFlow — retourner tel quel
  const formatEquipment = (eq: string) => eq;

  return (
    <div ref={dropdownRef} className="relative">
      <div ref={inputWrapperRef} className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => { if (results.length > 0) { updateDropdownPosition(); setShowDropdown(true); } }}
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder={placeholder || 'Rechercher un exercice...'}
        />
        {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 animate-spin" />}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && dropdownRect && typeof window !== 'undefined' && createPortal(
        <div
          ref={portalRef}
          // max-h ≈ 3 résultats (60 px × 3 = 180 px). Le scroll interne prend le relais au-delà.
          className="fixed z-[100] bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto overscroll-contain"
          style={{
            top: dropdownRect.top,
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: 180,
          }}
        >
          {results.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // évite blur de l'input avant le clic
              onClick={() => handleSelectExercise(exercise)}
              className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-3"
            >
              {/* Miniature GIF */}
              {exercise.gifUrl && (
                <img
                  src={exercise.gifUrl}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-100"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{exercise.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {exercise.targetMuscles.length > 0 && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {exercise.targetMuscles[0]}
                    </span>
                  )}
                  {exercise.equipments.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {formatEquipment(exercise.equipments[0])}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
