# -*- coding: utf-8 -*-
"""Rend les bibliothèques CUDA installées par pip visibles à CTranslate2.

Sous Windows, les DLL livrées dans `site-packages/nvidia/*/bin` ne sont pas dans le
chemin de recherche du système : sans cet ajout explicite, CTranslate2 ne les trouve pas
et bascule silencieusement sur le processeur — ou échoue à charger le modèle.
"""
import glob
import os
import sys


def activer():
    """Déclare les dossiers de DLL CUDA. Sans effet si le paquet n'est pas installé.

    Les deux mécanismes sont nécessaires, et c'est le piège de cette installation :
    `add_dll_directory` suffit à charger cuDNN au démarrage du modèle, mais CTranslate2
    réclame cuBLAS plus tard, au premier encodage, par un appel qui n'emprunte que la
    recherche standard de Windows. Sans l'ajout au PATH, le modèle se charge sur le GPU
    puis échoue en pleine transcription sur « cublas64_12.dll is not found ».
    """
    base = os.path.join(sys.prefix, 'Lib', 'site-packages', 'nvidia')
    dossiers = [d for d in glob.glob(os.path.join(base, '*', 'bin')) if os.path.isdir(d)]
    for dossier in dossiers:
        try:
            os.add_dll_directory(dossier)
        except OSError:
            pass
    if dossiers:
        os.environ['PATH'] = os.pathsep.join(dossiers) + os.pathsep + os.environ.get('PATH', '')
    return len(dossiers)


def peripherique(prefere='auto'):
    """Retourne ('cuda', 'float16') si le GPU répond, sinon ('cpu', 'int8')."""
    if prefere == 'cpu':
        return 'cpu', 'int8'
    activer()
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return 'cuda', 'float16'
    except Exception:
        pass
    return 'cpu', 'int8'
