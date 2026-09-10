# -*- coding: utf-8 -*-
"""Dictée vocale — enregistrement au micro et transcription par Whisper.

Trois usages :

    python dictee.py enregistrer            enregistre jusqu'à Entrée, puis transcrit
    python dictee.py transcrire <fichier>   transcrit un audio déjà enregistré
    python dictee.py peripheriques          liste les micros disponibles

La transcription est écrite en Markdown dans `transcriptions/`, horodatée, avec les
repères temporels par paragraphe : ils servent à retrouver un passage dans l'audio quand
on remet le texte au propre.

L'audio est conservé à côté du texte. Une transcription se refait ; une prise de parole,
non.
"""
import argparse
import datetime as dt
import io
import os
import re
import queue
import sys
import threading

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.join(ICI, 'transcriptions')

# Whisper travaille en 16 kHz mono : autant enregistrer directement à ce format plutôt
# que de rééchantillonner ensuite.
TAUX = 16000


def horodatage():
    return dt.datetime.now().strftime('%Y-%m-%d_%Hh%M')


def mmss(secondes):
    m, s = divmod(int(secondes), 60)
    return '%d:%02d' % (m, s)


# ─── Enregistrement ──────────────────────────────────────────────────────────

def enregistrer(chemin, peripherique=None, duree_max=None):
    """Enregistre au micro jusqu'à Entrée, ou jusqu'à `duree_max` secondes.

    Retourne (durée, niveau_crête). Le niveau sert à détecter un micro muet : un
    enregistrement techniquement réussi mais silencieux ne se voit qu'à l'écoute,
    et il est trop tard.
    """
    import sounddevice as sd
    import soundfile as sf

    morceaux = queue.Queue()
    fini = threading.Event()

    crete = [0.0]

    def rappel(donnees, _frames, _heure, statut):
        if statut:
            print('  ⚠ %s' % statut, file=sys.stderr)
        crete[0] = max(crete[0], float(abs(donnees).max()))
        morceaux.put(donnees.copy())

    def attendre_entree():
        try:
            input()
        except (EOFError, KeyboardInterrupt):
            pass
        fini.set()

    if duree_max is None:
        threading.Thread(target=attendre_entree, daemon=True).start()
        print('\n  ● Enregistrement en cours — appuyez sur Entrée pour arrêter.\n')
    else:
        threading.Timer(duree_max, fini.set).start()
        print('\n  ● Enregistrement en cours — %s, arrêt automatique.\n' % mmss(duree_max))
    debut = dt.datetime.now()
    with sf.SoundFile(chemin, mode='w', samplerate=TAUX, channels=1, subtype='PCM_16') as f:
        with sd.InputStream(samplerate=TAUX, channels=1, dtype='float32',
                            device=peripherique, callback=rappel):
            while not fini.is_set():
                try:
                    f.write(morceaux.get(timeout=0.2))
                except queue.Empty:
                    pass
            # Vider ce qui reste en file après l'arrêt.
            while not morceaux.empty():
                f.write(morceaux.get())

    duree = (dt.datetime.now() - debut).total_seconds()
    niveau = crete[0]
    print('  ■ Arrêté — %s enregistrées, niveau crête %.0f %%' % (mmss(duree), niveau * 100))
    if niveau < 0.01:
        print('  ⚠ Signal quasi nul : micro muet, coupé, ou mauvais périphérique ?')
        print('    Vérifiez avec « dictee.py peripheriques ».')
    print('')
    return duree, niveau


# ─── Transcription ───────────────────────────────────────────────────────────

def lire_glossaire():
    """Lit `glossaire.txt` : vocabulaire d'amorçage et corrections.

    Retourne (amorce, corrections). Sans amorçage, « FitFlow » ressort en « FIFLO ».
    Les lignes contenant `=>` ne sont pas transmises au modèle : ce sont des
    substitutions appliquées après coup, sur le texte produit.
    """
    chemin = os.path.join(ICI, 'glossaire.txt')
    if not os.path.exists(chemin):
        return None, []
    termes, corrections = [], []
    for ligne in io.open(chemin, encoding='utf-8'):
        ligne = ligne.strip()
        if not ligne or ligne.startswith('#'):
            continue
        if '=>' in ligne:
            faux, juste = (x.strip() for x in ligne.split('=>', 1))
            if faux:
                corrections.append((faux, juste))
        else:
            termes.append(ligne)
    return (', '.join(termes) + '.' if termes else None), corrections


def corriger(texte, corrections):
    """Applique les substitutions du glossaire, aux limites de mots."""
    for faux, juste in corrections:
        texte = re.sub(r'\b%s\b' % re.escape(faux), juste, texte, flags=re.IGNORECASE)
    return texte


def transcrire(audio, modele='large-v3', langue='fr', materiel='auto'):
    import cuda
    from faster_whisper import WhisperModel

    appareil, precision = cuda.peripherique(materiel)
    print('  Modèle %s sur %s (%s) — chargement…' % (modele, appareil.upper(), precision))
    m = WhisperModel(modele, device=appareil, compute_type=precision)

    amorce, corrections = lire_glossaire()
    if amorce:
        print('  Vocabulaire amorcé : %d termes, %d correction(s)'
              % (amorce.count(',') + 1, len(corrections)))

    segments, info = m.transcribe(
        audio,
        language=langue,
        # Le vocabulaire du projet, donné au décodeur comme s'il précédait l'audio.
        initial_prompt=amorce,
        # Découpe sur les silences : sans cela, Whisper invente du texte pendant les
        # blancs, ce qui est fréquent sur une présentation où l'on marque des pauses.
        vad_filter=True,
        vad_parameters={'min_silence_duration_ms': 700},
        # Le contexte précédent aide la ponctuation et la cohérence des termes.
        condition_on_previous_text=True,
        beam_size=5,
    )
    print('  Langue détectée : %s (%.0f %%) — durée %s\n'
          % (info.language, info.language_probability * 100, mmss(info.duration)))
    return [(g.start, g.end, corriger(g.text, corrections)) for g in segments], info


def ecrire_markdown(segments, info, audio, destination, titre=None):
    """Regroupe les segments en paragraphes et écrit le compte rendu."""
    paragraphes = []
    courant, debut_p = [], None
    for debut, fin, texte in segments:
        if debut_p is None:
            debut_p = debut
        courant.append(texte.strip())
        # Une pause franche ou un point final termine le paragraphe.
        fin_de_phrase = texte.strip().endswith(('.', '!', '?', '…'))
        if fin_de_phrase and (fin - debut_p) > 25:
            paragraphes.append((debut_p, ' '.join(courant)))
            courant, debut_p = [], None
    if courant:
        paragraphes.append((debut_p or 0, ' '.join(courant)))

    mots = sum(len(p.split()) for _, p in paragraphes)
    with open(destination, 'w', encoding='utf-8') as f:
        f.write('# %s\n\n' % (titre or 'Dictée du ' + dt.datetime.now().strftime('%d/%m/%Y à %Hh%M')))
        f.write('- Audio : `%s`\n' % os.path.basename(audio))
        f.write('- Durée : %s — %d mots — %d paragraphes\n' % (mmss(info.duration), mots, len(paragraphes)))
        f.write('- Transcrit par Whisper `large-v3`, langue %s\n\n' % info.language)
        f.write('> Texte brut de dictée : la ponctuation est celle du modèle, les repères\n')
        f.write('> temporels renvoient à l\'audio pour retrouver un passage.\n\n---\n\n')
        for debut, texte in paragraphes:
            f.write('**[%s]** %s\n\n' % (mmss(debut), texte))
    return mots, len(paragraphes)


# ─── Entrée du programme ─────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description='Dictée vocale par Whisper.')
    sp = p.add_subparsers(dest='action', required=True)

    pe = sp.add_parser('enregistrer', help='enregistrer au micro puis transcrire')
    pe.add_argument('--titre', help='titre du compte rendu')
    pe.add_argument('--peripherique', type=int, help='numéro du micro (voir « peripheriques »)')
    pe.add_argument('--modele', default='large-v3')
    pe.add_argument('--materiel', default='auto', choices=['auto', 'cpu'])
    pe.add_argument('--sans-transcription', action='store_true', help='enregistrer seulement')
    pe.add_argument('--duree', type=float, help='arrêt automatique après N secondes')

    pt = sp.add_parser('transcrire', help='transcrire un fichier audio existant')
    pt.add_argument('fichier')
    pt.add_argument('--titre')
    pt.add_argument('--modele', default='large-v3')
    pt.add_argument('--materiel', default='auto', choices=['auto', 'cpu'])

    sp.add_parser('peripheriques', help='lister les micros')

    a = p.parse_args()
    os.makedirs(SORTIE, exist_ok=True)

    if a.action == 'peripheriques':
        import sounddevice as sd
        for i, d in enumerate(sd.query_devices()):
            if d['max_input_channels'] > 0:
                defaut = '  ← par défaut' if i == sd.default.device[0] else ''
                print('  %2d  %s%s' % (i, d['name'], defaut))
        return

    if a.action == 'enregistrer':
        audio = os.path.join(SORTIE, 'dictee_%s.wav' % horodatage())
        enregistrer(audio, a.peripherique, a.duree)
        if a.sans_transcription:
            print('  Audio conservé : %s' % audio)
            return
        fichier = audio
    else:
        fichier = a.fichier
        if not os.path.exists(fichier):
            sys.exit('  Fichier introuvable : %s' % fichier)

    segments, info = transcrire(fichier, a.modele, 'fr', a.materiel)
    base = os.path.splitext(os.path.basename(fichier))[0]
    destination = os.path.join(SORTIE, base + '.md')
    mots, n = ecrire_markdown(segments, info, fichier, destination, getattr(a, 'titre', None))
    print('  ✓ %d mots, %d paragraphes' % (mots, n))
    print('  → %s' % destination)


if __name__ == '__main__':
    main()
