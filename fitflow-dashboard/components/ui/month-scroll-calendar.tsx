"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { addDays, getDay, startOfMonth, format, isSameMonth } from "date-fns";
import { fr } from "date-fns/locale";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

/** 42 cases par mois — 6 semaines pleines. Tous les blocs ont ainsi la même
 *  hauteur, ce qui rend l'accroche du défilement prévisible et évite les sauts
 *  de mise en page entre un mois de 5 et un mois de 6 semaines. */
const CELLS = 42;

/** Grille d'un mois : les jours du mois, précédés et suivis de ceux des mois
 *  voisins pour compléter les semaines. Lundi est le premier jour. */
function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const lead = (getDay(first) + 6) % 7; // getDay : 0 = dimanche
  const start = addDays(first, -lead);
  return Array.from({ length: CELLS }, (_, i) => addDays(start, i));
}

interface MonthScrollCalendarProps {
  /** Mois affiché. Le composant ne modifie pas cette valeur lui-même : il
   *  signale les changements par onMonthChange. */
  month: Date;
  onMonthChange: (month: Date) => void;
  /** Contenu d'une case. `inMonth` distingue les jours du mois affiché de ceux
   *  qui ne servent qu'à compléter la semaine. */
  renderDay: (day: Date, meta: { inMonth: boolean }) => React.ReactNode;
  /** Amplitude du sélecteur d'année, autour de l'année courante. */
  yearRange?: number;
  /** Hauteur d'une case en pixels. La hauteur du cadre en découle, de sorte
   *  qu'exactement un mois soit visible : avec des cases carrées, six rangées
   *  débordaient de l'écran dès que la colonne était large. */
  cellHeight?: number;
}

const GAP = 2; // gap-0.5

export function MonthScrollCalendar({
  month,
  onMonthChange,
  renderDay,
  yearRange = 5,
  cellHeight = 32,
}: MonthScrollCalendarProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  /** Vrai pendant un défilement programmé : empêche l'observateur de riposter
   *  en signalant les mois traversés au passage. */
  const scrollingRef = useRef(false);

  const [visibleIndex, setVisibleIndex] = useState(monthIndex);

  // 6 rangées + 5 espacements : hauteur d'un bloc, et donc du cadre visible.
  const blockHeight = 6 * cellHeight + 5 * GAP;

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)),
    [year]
  );

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: yearRange * 2 + 1 }, (_, i) => now - yearRange + i);
  }, [yearRange]);

  /** Amène le mois demandé en haut du cadre. Tous les blocs ayant la même
   *  hauteur, la position se calcule — pas besoin de mesurer, ce qui évite les
   *  surprises liées à l'ancêtre positionné de offsetTop. */
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scrollingRef.current = true;
    scroller.scrollTo({ top: index * blockHeight, behavior });
    setVisibleIndex(index);
    // La fin d'un défilement lissé n'est pas notifiée : on relâche le verrou
    // après une durée couvrant l'animation.
    window.setTimeout(() => { scrollingRef.current = false; }, behavior === "smooth" ? 420 : 0);
  }, [blockHeight]);

  // Positionnement initial et après changement d'année, sans animation.
  useEffect(() => {
    scrollToIndex(monthIndex, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  // Suit le mois réellement visible quand l'utilisateur fait défiler à la molette.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingRef.current) return;
        const shown = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!shown) return;
        const index = blockRefs.current.indexOf(shown.target as HTMLDivElement);
        if (index >= 0 && index !== visibleIndex) {
          setVisibleIndex(index);
          onMonthChange(new Date(year, index, 1));
        }
      },
      { root: scroller, threshold: [0.4, 0.6, 0.8] }
    );

    blockRefs.current.forEach((b) => b && observer.observe(b));
    return () => observer.disconnect();
  }, [year, visibleIndex, onMonthChange]);

  /** Mois précédent ou suivant. Au passage d'une année, on change d'année et le
   *  positionnement initial place le mois attendu. */
  const step = (delta: number) => {
    const next = visibleIndex + delta;
    if (next < 0) {
      onMonthChange(new Date(year - 1, 11, 1));
      return;
    }
    if (next > 11) {
      onMonthChange(new Date(year + 1, 0, 1));
      return;
    }
    scrollToIndex(next);
    onMonthChange(new Date(year, next, 1));
  };

  return (
    <div>
      {/* En-tête : mois visible, sélecteur d'année, flèches verticales */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-semibold text-gray-900 capitalize truncate">
            {format(months[visibleIndex], "MMMM", { locale: fr })}
          </span>
          <label className="sr-only" htmlFor="calendar-year">Année</label>
          <select
            id="calendar-year"
            value={year}
            onChange={(e) => onMonthChange(new Date(Number(e.target.value), visibleIndex, 1))}
            className="bg-transparent text-sm font-medium text-gray-500 border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col shrink-0">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Mois précédent"
            className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Mois suivant"
            className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Jours de la semaine : hors du cadre défilant, ils restent visibles */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Cadre défilant : un point d'accroche par mois. scrollbar-none n'existant
          pas en Tailwind, la barre est masquée en CSS dans globals.css. */}
      <div
        ref={scrollerRef}
        className="calendar-scroller overflow-y-auto"
        // 6 rangées, 5 espacements : la hauteur d'exactement un bloc.
        style={{ scrollSnapType: "y mandatory", height: blockHeight }}
      >
        {months.map((m, i) => (
          <div
            key={m.toISOString()}
            ref={(el) => { blockRefs.current[i] = el; }}
            style={{ scrollSnapAlign: "start" }}
            className="grid grid-cols-7 gap-0.5"
          >
            {monthGrid(m).map((day) => (
              <div key={day.toISOString()} style={{ height: cellHeight }}>
                {renderDay(day, { inMonth: isSameMonth(day, m) })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
