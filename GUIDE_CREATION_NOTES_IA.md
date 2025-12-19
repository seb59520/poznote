# 🎨 Guide : Création de Notes avec IA

## ✅ Fonctionnalité Implémentée

La fonctionnalité de **création de notes à partir d'un prompt IA** est maintenant disponible dans Poznote !

---

## 🚀 Comment Utiliser

### Méthode 1 : Via le Modal de Création

1. Cliquez sur le bouton **"+"** dans la barre latérale
2. Sélectionnez **"Note avec IA"** (icône robot 🤖)
3. Entrez votre prompt (ex: "Plan de projet migration cloud")
4. Choisissez le type de note (optionnel)
5. La note est créée automatiquement et vous êtes redirigé vers elle

### Méthode 2 : Via Slash Command

1. Ouvrez ou créez une note
2. Tapez `/ai-create` dans l'éditeur
3. Suivez les instructions pour créer votre note

---

## 📝 Types de Notes Disponibles

### 1. **structured** (par défaut)
Note structurée générale avec sections, listes, et formatage.

**Exemple de prompt** : "Plan de projet migration cloud"

**Résultat** : Note avec sections (Objectifs, Étapes, Ressources, etc.)

---

### 2. **meeting** (réunion)
Compte-rendu de réunion structuré.

**Exemple de prompt** : "Réunion équipe du 15 décembre sur le nouveau produit"

**Résultat** : Note avec ordre du jour, participants, points discutés, décisions, actions

---

### 3. **project** (projet)
Plan de projet détaillé.

**Exemple de prompt** : "Plan de projet pour migration vers cloud AWS"

**Résultat** : Note avec objectifs, étapes, délais, ressources, risques, checklist

---

### 4. **checklist** (liste de tâches)
Liste de tâches structurée.

**Exemple de prompt** : "Checklist pour déménagement"

**Résultat** : Note avec checklist complète organisée par catégories

---

### 5. **summary** (résumé)
Résumé structuré d'un sujet.

**Exemple de prompt** : "Résumé des fonctionnalités du nouveau framework"

**Résultat** : Note avec résumé organisé et hiérarchisé

---

### 6. **brainstorm** (brainstorming)
Idées structurées par catégories.

**Exemple de prompt** : "Idées pour améliorer l'expérience utilisateur"

**Résultat** : Note avec idées organisées par catégories et priorités

---

## 💡 Exemples de Prompts

### Prompts Efficaces

✅ **Bon** :
- "Plan de projet pour migration vers cloud AWS"
- "Compte-rendu de réunion équipe produit du 15 décembre"
- "Checklist complète pour déménagement en janvier"
- "Brainstorming idées pour nouveau produit mobile"
- "Résumé des fonctionnalités principales de React 19"

❌ **Moins efficace** :
- "Note" (trop vague)
- "Test" (pas assez spécifique)
- "..." (vide)

---

## 🎯 Fonctionnalités Automatiques

Lors de la création d'une note avec IA :

1. ✅ **Titre généré automatiquement** à partir du prompt
2. ✅ **Tags suggérés** et appliqués automatiquement
3. ✅ **Dossier respecté** : La note est créée dans le dossier sélectionné
4. ✅ **Workspace respecté** : La note est créée dans le workspace actuel
5. ✅ **Embedding généré** : Si la recherche sémantique est activée
6. ✅ **Redirection automatique** : Vous êtes redirigé vers la nouvelle note

---

## 🔧 Configuration

### Prérequis

1. **IA activée** dans Settings → AI Features
2. **Génération activée** dans Settings → AI Features
3. **Clé API OpenRouter** configurée dans `.env`

### Vérification

Pour vérifier que tout fonctionne :

```bash
curl -X POST http://localhost:8040/api/api_ai_create_note.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Plan de projet test",
    "type": "project",
    "workspace": "Poznote"
  }'
```

---

## 📊 Structure des Notes Générées

Les notes générées suivent généralement cette structure :

### Note "project"
```
# [Titre du projet]

## Objectifs
- Objectif 1
- Objectif 2

## Étapes
1. Étape 1
2. Étape 2

## Ressources
- Ressource 1
- Ressource 2

## Checklist
- [ ] Tâche 1
- [ ] Tâche 2
```

### Note "meeting"
```
# [Titre de la réunion]

## Participants
- Participant 1
- Participant 2

## Ordre du jour
1. Point 1
2. Point 2

## Points discutés
- Point 1 : Discussion...
- Point 2 : Discussion...

## Décisions
- Décision 1
- Décision 2

## Actions
- [ ] Action 1 (Responsable: X)
- [ ] Action 2 (Responsable: Y)
```

---

## 🎨 Personnalisation

### Modifier les Templates

Les templates sont définis dans `src/ai/ai_generator.php` dans la méthode `createNoteFromPrompt()`.

Vous pouvez modifier les `systemPrompts` pour personnaliser le style de génération :

```php
$systemPrompts = [
    'structured' => 'Votre prompt personnalisé...',
    'meeting' => 'Votre prompt personnalisé...',
    // etc.
];
```

---

## ⚡ Astuces

1. **Soyez spécifique** : Plus le prompt est détaillé, meilleure sera la note
2. **Utilisez les types** : Choisissez le type approprié pour de meilleurs résultats
3. **Modifiez après** : La note générée est un point de départ, vous pouvez la modifier
4. **Réutilisez** : Créez des templates réutilisables pour vos besoins fréquents

---

## 🐛 Dépannage

### La note n'est pas créée

- Vérifiez que l'IA est activée dans Settings
- Vérifiez que la clé API OpenRouter est configurée
- Vérifiez les logs du conteneur : `docker compose logs webserver`

### La note est vide ou mal formatée

- Essayez un prompt plus spécifique
- Vérifiez que le type de note est approprié
- Regardez les erreurs dans la console du navigateur (F12)

### L'option "Note avec IA" n'apparaît pas

- Vérifiez que `ai-assistant.js` est chargé
- Vérifiez que l'IA est activée dans Settings
- Rechargez la page

---

## 📈 Améliorations Futures Possibles

- [ ] Templates personnalisables par utilisateur
- [ ] Historique des prompts utilisés
- [ ] Suggestions de prompts basées sur vos notes existantes
- [ ] Génération de plusieurs notes en batch
- [ ] Prévisualisation avant création

---

## ✅ Checklist d'Utilisation

- [ ] IA activée dans Settings
- [ ] Génération activée dans Settings
- [ ] Clé API OpenRouter configurée
- [ ] Conteneur redémarré
- [ ] Test de création effectué

---

**La fonctionnalité est maintenant disponible ! Essayez-la avec `/ai-create` ou via le modal de création.** 🎉

