# Commande: generate-plan

Génère un plan détaillé pour implémenter une nouvelle fonctionnalité dans l'app mobile FitFlow.

## Argument

$ARGUMENTS - Description de la fonctionnalité à implémenter

## Instructions

1. **Analyse la demande** : Comprends bien la fonctionnalité décrite dans "$ARGUMENTS"

2. **Explore le code existant** : Identifie les fichiers et patterns existants qui seront impactés ou réutilisés

3. **Génère un plan structuré** dans un fichier `plans/PLAN-{nom-fonctionnalité}.md` contenant :

### Structure du plan

```markdown
# Plan: {Nom de la fonctionnalité}

> Date: {date du jour}
> Statut: À faire

## Résumé
{Description courte de la fonctionnalité}

## Contexte
{Pourquoi cette fonctionnalité est nécessaire}

## Fichiers impactés
- [ ] `fichier1.js` - {description des modifications}
- [ ] `fichier2.js` - {description des modifications}

## Étapes d'implémentation

### Étape 1: {Titre}
- Description détaillée
- Code exemple si pertinent

### Étape 2: {Titre}
- Description détaillée
- Code exemple si pertinent

## Nouveaux écrans (si applicable)
| Écran | Description | Navigation |
|-------|-------------|------------|
| XxxScreen.js | Description | Stack/Tab |

## Composants (si applicable)
{Nouveaux composants à créer ou modifier}

## Navigation (si applicable)
{Modifications de AppNavigator.js}

## Appels API (si applicable)
{Nouveaux endpoints à appeler}

## Tests à prévoir
- [ ] Test 1
- [ ] Test 2

## Points d'attention
- Risques potentiels
- Dépendances
- Questions à clarifier
```

4. **Crée le dossier `plans/`** s'il n'existe pas

5. **Confirme** la création du plan avec le chemin du fichier

## Exemple d'utilisation

```
/generate-plan Ajouter un écran de suivi des calories avec graphique hebdomadaire
```
