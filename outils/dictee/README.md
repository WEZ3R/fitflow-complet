# Dictée vocale

Enregistre au micro et transcrit par Whisper, en français, sur le GPU.
Sert à préparer la soutenance en parlant plutôt qu'en rédigeant.

## Utilisation

Depuis `outils/dictee/` :

```bash
# Enregistrer puis transcrire — le cas courant
.venv/Scripts/python.exe dictee.py enregistrer --titre "Plan de présentation"

# Transcrire un audio déjà enregistré (wav, mp3, m4a, mp4…)
.venv/Scripts/python.exe dictee.py transcrire chemin/vers/audio.m4a

# Lister les micros, si le mauvais est pris par défaut
.venv/Scripts/python.exe dictee.py peripheriques
.venv/Scripts/python.exe dictee.py enregistrer --peripherique 2
```

L'enregistrement s'arrête sur **Entrée**. Tout est écrit dans `transcriptions/` :
un `.wav` et un `.md` portant le même horodatage.

Pour une répétition chronométrée, `--duree 600` arrête seul au bout de dix minutes.

À l'arrêt, l'outil affiche le **niveau crête** et prévient si le signal est quasi nul :
un enregistrement techniquement réussi mais muet ne se découvre sinon qu'à l'écoute,
quand il est trop tard pour refaire la prise.

## Ce que produit la transcription

Un Markdown avec un repère temporel par paragraphe :

```markdown
**[0:00]** Bonjour. Je m'appelle Marc Yrius et je vous présente FitFlow…

**[2:14]** L'exigence de performance demandait des réponses de l'API sous 300 ms…
```

Les repères servent à retrouver un passage dans l'audio quand on remet le texte au
propre. **L'audio est conservé** : une transcription se refait, une prise de parole non.

## Le glossaire, et pourquoi il compte

`glossaire.txt` fait deux choses.

**Il amorce le vocabulaire.** Whisper transcrit ce qu'il connaît : sans amorçage,
« FitFlow » ressort en « FIFLO ». Les termes du fichier sont donnés au décodeur comme
s'ils précédaient l'audio, ce qui suffit à les faire reconnaître.

**Il corrige après coup.** Les lignes en `faux => juste` sont appliquées sur le texte
produit, aux limites de mots, sans tenir compte de la casse. Elles rattrapent ce que
l'amorçage laisse passer.

Mesuré sur un même enregistrement d'essai :

| | Sans glossaire | Avec |
| --- | --- | --- |
| Nom | Marc **Irius** | Marc **Yrius** |
| Produit | **FIFLO** | **FitFlow** |
| Sigle | de **la pi** | de **l'API** |

Ajoute tes propres termes au fil des dictées — c'est un fichier texte ordinaire. Garder
la liste sous deux cents mots : au-delà, l'amorçage se dilue.

## Performance

Sur la RTX 3060, modèle `large-v3` : **34 secondes d'audio transcrites en 10 secondes**,
chargement du modèle compris. Une présentation de vingt minutes prend environ deux
minutes.

Sans GPU, l'outil bascule seul sur le processeur en `int8` — comptez plutôt le temps réel
de l'enregistrement. Pour forcer : `--materiel cpu`. Pour un modèle plus léger :
`--modele medium` ou `--modele small`.

## Installation, si l'environnement est à refaire

```bash
python -m venv .venv
.venv/Scripts/python.exe -m pip install faster-whisper sounddevice soundfile numpy
.venv/Scripts/python.exe -m pip install nvidia-cublas-cu12 nvidia-cudnn-cu12   # GPU
```

Le modèle `large-v3` (environ 3 Go) se télécharge au premier lancement et se garde dans
`~/.cache/huggingface`.

### Le piège CUDA sous Windows

Les DLL installées par pip ne sont pas dans le chemin de recherche du système. `cuda.py`
s'en occupe, par **deux** mécanismes, et les deux sont nécessaires :

- `os.add_dll_directory()` suffit à charger cuDNN au démarrage du modèle ;
- mais CTranslate2 réclame **cuBLAS plus tard**, au premier encodage, par un appel qui
  n'emprunte que la recherche standard de Windows.

Sans l'ajout au `PATH`, le modèle se charge sur le GPU puis échoue en pleine
transcription sur `cublas64_12.dll is not found` — un message trompeur, puisque le
fichier est bien présent.

## Réglages notables

- **Filtre de silence actif.** Sans lui, Whisper invente du texte pendant les blancs, ce
  qui arrive constamment sur une présentation où l'on marque des pauses.
- **Enregistrement direct en 16 kHz mono**, le format attendu par le modèle : pas de
  rééchantillonnage, pas de perte.
- **Paragraphes coupés sur la ponctuation**, et seulement au-delà de 25 secondes — sinon
  chaque phrase deviendrait un paragraphe.
