'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { programsAPI, sessionsAPI, sessionTemplatesAPI } from '@/lib/api';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Check,
  FileText,
  Square,
  Search,
  X,
  Copy,
  ClipboardPaste,
  Trash2,
} from 'lucide-react';
import type { Program, Session } from '@/types';

type SessionStatus = 'done' | 'draft' | 'empty';

const toLocalDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface SessionsByDate {
  [dateKey: string]: Session;
}

interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  exercisesData: Record<string, unknown>[];
}

interface ContextMenu {
  x: number;
  y: number;
  dateKey: string;
}

interface HistoryEntry {
  dateKey: string;
  previousSession: Session | null;
}

function getSessionStatus(session: Session | undefined): SessionStatus {
  if (!session) return 'empty';
  if (session.status === 'DONE') return 'done';
  if (session.status === 'DRAFT') return 'draft';
  return 'empty';
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  done: 'bg-green-100 border-green-500 hover:bg-green-200',
  draft: 'bg-yellow-100 border-yellow-500 hover:bg-yellow-200',
  empty: 'bg-white border-gray-200 hover:bg-gray-50',
};

function StatusIcon({ status }: { status: SessionStatus }) {
  if (status === 'done') return <Check className="h-4 w-4 text-green-600" />;
  if (status === 'draft') return <FileText className="h-4 w-4 text-yellow-600" />;
  return <Square className="h-4 w-4 text-gray-300" />;
}

export default function ProgramCalendarPage() {
  const { programId } = useParams<{ programId: string }>();
  const router = useRouter();

  const [program, setProgram] = useState<Program | null>(null);
  const [sessions, setSessions] = useState<SessionsByDate>({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Templates
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SessionTemplate | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Sélection / copy-paste / undo / redo
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Session | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [redoHistory, setRedoHistory] = useState<HistoryEntry[]>([]);

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef({ selectedDay: null as string | null, sessions: {} as SessionsByDate, clipboard: null as Session | null, history: [] as HistoryEntry[], redoHistory: [] as HistoryEntry[] });

  const fetchSessions = useCallback(async () => {
    if (!programId) return;
    try {
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const res = await sessionsAPI.getByProgram(programId, {
        startDate: toLocalDateStr(startDate),
        endDate: toLocalDateStr(endDate),
      });
      const byDate: SessionsByDate = {};
      (res.data.data as Session[]).forEach((s) => {
        const key = toLocalDateStr(new Date(s.date));
        byDate[key] = s;
      });
      setSessions(byDate);
    } catch {
      console.error('Error fetching sessions');
    }
  }, [programId, currentMonth]);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        const res = await programsAPI.getById(programId);
        setProgram(res.data.data);
      } catch {
        console.error('Error fetching program');
      } finally {
        setLoading(false);
      }
    };
    fetchProgram();
  }, [programId]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await sessionTemplatesAPI.getAll();
        setTemplates(res.data.data ?? []);
      } catch {
        console.error('Error fetching templates');
      }
    };
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (program) fetchSessions();
  }, [program, fetchSessions]);

  // Fermer le dropdown et le menu contextuel au clic extérieur
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Synchroniser la ref avec le state courant
  useEffect(() => {
    actionsRef.current = { selectedDay, sessions, clipboard, history, redoHistory };
  });

  // Raccourcis clavier Ctrl+C / Ctrl+V / Ctrl+Z / Suppr — montage unique
  useEffect(() => {
    const applyEntry = async (entry: HistoryEntry, currentSess: SessionsByDate) => {
      if (entry.previousSession === null) {
        const current = currentSess[entry.dateKey];
        if (current) await sessionsAPI.delete(current.id);
      } else {
        const s = entry.previousSession;
        await sessionsAPI.upsert({
          programId,
          date: entry.dateKey,
          status: s.status,
          name: s.name,
          exercises: s.exercises?.map((ex) => ({
            name: ex.name, category: ex.category, sets: ex.sets, reps: ex.reps,
            weight: ex.weight, duration: ex.duration, restTime: ex.restTime,
            videoUrl: ex.videoUrl, gifUrl: ex.gifUrl, description: ex.description,
            exerciseRefId: ex.exerciseRefId, supersetGroup: ex.supersetGroup,
          })),
        });
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      const { selectedDay: day, sessions: sess, clipboard: clip, history: hist, redoHistory: redo } = actionsRef.current;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (redo.length === 0) return;
        const entry = redo[redo.length - 1];
        setRedoHistory((prev) => prev.slice(0, -1));
        setHistory((prev) => [...prev.slice(-49), { dateKey: entry.dateKey, previousSession: sess[entry.dateKey] ?? null }]);
        try {
          await applyEntry(entry, sess);
          await fetchSessions();
        } catch (err) {
          console.error('Redo error', err);
          setRedoHistory((prev) => [...prev, entry]);
        }
        return;
      }

      if (mod && e.key === 'z') {
        e.preventDefault();
        if (hist.length === 0) return;
        const entry = hist[hist.length - 1];
        setHistory((prev) => prev.slice(0, -1));
        setRedoHistory((prev) => [...prev.slice(-49), { dateKey: entry.dateKey, previousSession: sess[entry.dateKey] ?? null }]);
        try {
          await applyEntry(entry, sess);
          await fetchSessions();
        } catch (err) {
          console.error('Undo error', err);
          setHistory((prev) => [...prev, entry]);
        }
        return;
      }

      if (!day) return;
      if (mod && e.key === 'c') {
        e.preventDefault();
        const session = sess[day];
        if (session) setClipboard(session);
      } else if (mod && e.key === 'v') {
        e.preventDefault();
        if (clip) {
          setHistory((prev) => [...prev.slice(-49), { dateKey: day, previousSession: sess[day] ?? null }]);
          setRedoHistory([]);
          try {
            await sessionsAPI.upsert({
              programId, date: day, status: clip.status, name: clip.name,
              exercises: clip.exercises?.map((ex) => ({
                name: ex.name, category: ex.category, sets: ex.sets, reps: ex.reps,
                weight: ex.weight, duration: ex.duration, restTime: ex.restTime,
                videoUrl: ex.videoUrl, gifUrl: ex.gifUrl, description: ex.description,
                exerciseRefId: ex.exerciseRefId, supersetGroup: ex.supersetGroup,
              })),
            });
            await fetchSessions();
          } catch { console.error('Paste error'); }
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT') return;
        const session = sess[day];
        if (!session) return;
        setHistory((prev) => [...prev.slice(-49), { dateKey: day, previousSession: session }]);
        setRedoHistory([]);
        try {
          await sessionsAPI.delete(session.id);
          setSessions((prev) => { const next = { ...prev }; delete next[day]; return next; });
          setSelectedDay(null);
        } catch { console.error('Delete error'); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assignTemplateToDay = async (dateKey: string) => {
    if (!selectedTemplate) return;
    setHistory((prev) => [...prev.slice(-49), { dateKey, previousSession: sessions[dateKey] ?? null }]);
    setRedoHistory([]);
    try {
      await sessionsAPI.upsert({
        programId,
        date: dateKey,
        status: 'DONE',
        name: selectedTemplate.name,
        exercises: selectedTemplate.exercisesData,
      });
      await fetchSessions();
    } catch {
      console.error('Error assigning template');
    }
  };

  const pasteSession = async (dateKey: string) => {
    if (!clipboard) return;
    setHistory((prev) => [...prev.slice(-49), { dateKey, previousSession: sessions[dateKey] ?? null }]);
    setRedoHistory([]);
    try {
      await sessionsAPI.upsert({
        programId,
        date: dateKey,
        status: clipboard.status,
        name: clipboard.name,
        exercises: clipboard.exercises?.map((ex) => ({
          name: ex.name,
          category: ex.category,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          duration: ex.duration,
          restTime: ex.restTime,
          videoUrl: ex.videoUrl,
          gifUrl: ex.gifUrl,
          description: ex.description,
          exerciseRefId: ex.exerciseRefId,
          supersetGroup: ex.supersetGroup,
        })),
      });
      await fetchSessions();
    } catch {
      console.error('Error pasting session');
    }
    setContextMenu(null);
  };

  const deleteSession = async (dateKey: string) => {
    const session = sessions[dateKey];
    if (!session) return;
    setHistory((prev) => [...prev.slice(-49), { dateKey, previousSession: session }]);
    setRedoHistory([]);
    try {
      await sessionsAPI.delete(session.id);
      setSessions((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      if (selectedDay === dateKey) setSelectedDay(null);
    } catch {
      console.error('Error deleting session');
    }
    setContextMenu(null);
  };

  // Gestion simple clic / double clic
  const handleDayInteraction = (date: Date) => {
    const key = toLocalDateStr(date);
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      // Double clic → naviguer vers la séance
      const session = sessions[key];
      if (session) {
        router.push(`/coach/programs/${programId}/sessions/${session.id}/edit`);
      } else {
        router.push(`/coach/programs/${programId}/sessions/new?date=${key}`);
      }
    } else {
      clickTimerRef.current = setTimeout(async () => {
        clickTimerRef.current = null;
        if (selectedTemplate) {
          await assignTemplateToDay(key);
        } else {
          setSelectedDay((prev) => (prev === key ? null : key));
        }
      }, 220);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, dateKey: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, dateKey });
    setSelectedDay(dateKey);
  };

  const getDaysInMonth = (): (Date | null)[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    // Semaine commençant le LUNDI, convention française.
    // `getDay()` renvoie 0 pour dimanche : on le ramène en fin de semaine (6) et on
    // décale les autres jours d'un cran, sinon la grille démarrerait un dimanche.
    const offset = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Programme non trouvé</p>
      </div>
    );
  }

  const days = getDaysInMonth();
  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{program.title}</h1>
          <p className="text-gray-600 mt-1">Planification des séances</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/coach/dashboard')}>
          Retour au dashboard
        </Button>
      </div>

      {/* Legend */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Légende des statuts</h3>
          <div className="flex items-center gap-6">
            {[
              { icon: <Square className="h-5 w-5 text-gray-300" />, label: 'Vide' },
              { icon: <FileText className="h-5 w-5 text-yellow-600" />, label: 'Brouillon' },
              { icon: <Check className="h-5 w-5 text-green-600" />, label: 'Terminé' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                {icon}
                <span className="text-sm text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Template selector */}
      <Card>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Séance à appliquer :
          </span>

          {selectedTemplate ? (
            <div className="flex items-center gap-2 bg-primary-50 border border-primary-300 rounded-lg px-3 py-1.5">
              <span className="text-sm font-medium text-primary-800">{selectedTemplate.name}</span>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-primary-500 hover:text-primary-700 transition-colors"
                title="Désélectionner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative flex-1 max-w-sm" ref={dropdownRef}>
              <div
                className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 cursor-pointer hover:border-gray-400 transition-colors bg-white"
                onClick={() => setShowDropdown((v) => !v)}
              >
                <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Rechercher un template..."
                  value={templateSearch}
                  onChange={(e) => {
                    setTemplateSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(true);
                  }}
                  className="text-sm outline-none bg-transparent flex-1 placeholder-gray-400"
                />
              </div>

              {showDropdown && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredTemplates.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">
                      {templates.length === 0 ? 'Aucun template créé' : 'Aucun résultat'}
                    </div>
                  ) : (
                    filteredTemplates.map((t) => (
                      <button
                        key={t.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setSelectedTemplate(t);
                          setShowDropdown(false);
                          setTemplateSearch('');
                        }}
                      >
                        <span className="font-medium text-gray-800">{t.name}</span>
                        {t.description && (
                          <span className="ml-2 text-gray-400 text-xs">{t.description}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {selectedTemplate && (
            <p className="text-xs text-gray-500">
              Cliquez sur un jour pour appliquer · Double-clic pour éditer
            </p>
          )}
          {!selectedTemplate && (
            <p className="text-xs text-gray-500">
              Simple clic = sélectionner · Double-clic = éditer · Clic droit = menu
            </p>
          )}
        </div>

        {clipboard && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <ClipboardPaste className="h-3.5 w-3.5" />
            <span>
              Presse-papier : <span className="font-medium text-gray-700">{clipboard.name || `${clipboard.exercises?.length ?? 0} exercices`}</span>
              {' '}— Ctrl+V pour coller sur la journée sélectionnée
            </span>
          </div>
        )}
      </Card>

      {/* Calendar */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-semibold text-gray-900 capitalize">{monthLabel}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d) => (
            <div key={d} className="text-center font-semibold text-gray-700 py-2 text-sm">
              {d}
            </div>
          ))}
          {days.map((date, idx) => {
            if (!date) return <div key={`empty-${idx}`} className="aspect-square" />;
            const key = toLocalDateStr(date);
            const session = sessions[key];
            const status = getSessionStatus(session);
            const isSelected = selectedDay === key;

            return (
              <button
                key={key}
                onClick={() => handleDayInteraction(date)}
                onContextMenu={(e) => handleContextMenu(e, key)}
                className={`
                  aspect-square border-2 rounded-lg p-2 transition-all flex flex-col items-center justify-between
                  ${STATUS_COLORS[status]}
                  ${isToday(date) ? 'ring-2 ring-primary-500' : ''}
                  ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}
                  ${selectedTemplate ? 'cursor-cell' : ''}
                `}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-sm font-semibold ${isToday(date) ? 'text-primary-600' : 'text-gray-700'}`}
                  >
                    {date.getDate()}
                  </span>
                  <StatusIcon status={status} />
                </div>
                {session ? (
                  <div className="text-xs text-gray-700 font-medium truncate w-full text-center mt-1">
                    {session.name || `${session.exercises?.length ?? 0} ex.`}
                  </div>
                ) : (
                  <Plus className="h-4 w-4 text-gray-400" />
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Cycle info */}
      {program.cycleDays && (
        <Card>
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Cycle de {program.cycleDays} jours</h3>
              <p className="text-sm text-gray-600">Les séances se répéteront selon ce cycle</p>
            </div>
          </div>
        </Card>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-36"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            onClick={() => {
              const session = sessions[contextMenu.dateKey];
              if (session) setClipboard(session);
              setContextMenu(null);
            }}
            disabled={!sessions[contextMenu.dateKey]}
          >
            <Copy className="h-4 w-4 text-gray-500" />
            Copier
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => pasteSession(contextMenu.dateKey)}
            disabled={!clipboard}
          >
            <ClipboardPaste className="h-4 w-4 text-gray-500" />
            Coller
          </button>
          <hr className="my-1 border-gray-100" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={() => deleteSession(contextMenu.dateKey)}
            disabled={!sessions[contextMenu.dateKey]}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

