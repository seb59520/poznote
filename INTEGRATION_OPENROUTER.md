# Intégration OpenRouter - Guide Complet

Ce document décrit l'intégration complète des fonctionnalités IA dans Poznote utilisant OpenRouter.

## 📋 Vue d'ensemble

OpenRouter est une API unifiée qui permet d'accéder à plusieurs modèles d'IA (OpenAI, Anthropic, etc.) via une seule interface. Cette intégration ajoute 5 fonctionnalités principales :

1. **Recherche sémantique** - Trouver des notes similaires même sans mots-clés exacts
2. **Génération de contenu** - Résumer, développer, réécrire du texte
3. **Tagging automatique** - Suggérer des tags pertinents
4. **Notes liées** - Trouver des notes similaires/connexes
5. **Extraction d'informations** - Extraire dates, tâches, personnes, sujets

---

## 🚀 Installation

### 1. Configuration OpenRouter

1. Créer un compte sur [OpenRouter.ai](https://openrouter.ai)
2. Obtenir votre clé API
3. Ajouter la clé dans les variables d'environnement Docker

### 2. Configuration Docker

Modifier `docker-compose.yml` :

```yaml
services:
  webserver:
    environment:
      # ... autres variables ...
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:-}
      AI_ENABLED: ${AI_ENABLED:-0}
```

Et dans `.env` :

```bash
OPENROUTER_API_KEY=votre_cle_api_openrouter
AI_ENABLED=1
```

### 3. Activer les fonctionnalités

Les fonctionnalités sont désactivées par défaut. Pour les activer :

1. Se connecter à Poznote
2. Aller dans Settings
3. Activer "AI Features" et les fonctionnalités individuelles souhaitées

Ou via SQL :

```sql
UPDATE settings SET value = '1' WHERE key = 'ai_enabled';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_semantic_search';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_generation';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_tagging';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_related_notes';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_extraction';
```

---

## 📁 Structure des Fichiers

```
src/
├── ai/
│   ├── ai_config.php              # Configuration OpenRouter
│   ├── openrouter_client.php      # Client API OpenRouter
│   ├── ai_embeddings.php          # Gestion des embeddings
│   └── ai_generator.php           # Génération de contenu
├── api/
│   ├── api_ai_generate.php        # API génération (résumé, expansion, réécriture)
│   ├── api_ai_search.php          # API recherche sémantique
│   ├── api_ai_suggest_tags.php    # API suggestion de tags
│   ├── api_ai_related_notes.php   # API notes liées
│   ├── api_ai_extract.php         # API extraction d'informations
│   └── api_ai_process_embeddings.php # API traitement embeddings
└── js/
    ├── ai-assistant.js             # Client JavaScript principal
    └── ai-integration.js           # Intégration UI
```

---

## 🔧 Fonctionnalités Détaillées

### 1. Recherche Sémantique

**Description** : Trouve des notes similaires en utilisant des embeddings vectoriels, même sans mots-clés exacts.

**Utilisation** :
```javascript
const results = await AIAssistant.semanticSearch('mon sujet', 'Poznote', {
    limit: 10,
    minSimilarity: 0.3
});
```

**API** : `POST /api/api_ai_search.php`
```json
{
    "query": "mon sujet",
    "workspace": "Poznote",
    "limit": 10,
    "min_similarity": 0.3
}
```

**Première utilisation** : Les embeddings doivent être générés pour les notes existantes :
```bash
curl -X POST http://localhost:8040/api/api_ai_process_embeddings.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{"action": "batch", "workspace": "Poznote", "limit": 100}'
```

---

### 2. Génération de Contenu

**Description** : Génère du contenu (résumé, expansion, réécriture) à partir d'un texte.

#### Résumer
```javascript
const summary = await AIAssistant.generate('summarize', content, {
    maxLength: 3
});
```

#### Développer
```javascript
const expanded = await AIAssistant.generate('expand', content, {
    style: 'detailed' // ou 'professional', 'academic', 'casual'
});
```

#### Réécrire
```javascript
const rewritten = await AIAssistant.generate('rewrite', content, {
    style: 'professional' // ou 'casual', 'concise', 'detailed', 'formal', 'simple'
});
```

**API** : `POST /api/api_ai_generate.php`
```json
{
    "action": "summarize|expand|rewrite",
    "content": "texte à traiter",
    "style": "professional",
    "max_length": 3
}
```

**Interface** :
- Boutons dans la toolbar : Résumer, Développer, Réécrire
- Slash commands : `/ai-summarize`, `/ai-expand`, `/ai-rewrite`

---

### 3. Tagging Automatique

**Description** : Suggère automatiquement des tags pertinents basés sur le titre et le contenu.

**Utilisation** :
```javascript
const tags = await AIAssistant.suggestTags(noteId, title, content);
```

**API** : `POST /api/api_ai_suggest_tags.php`
```json
{
    "note_id": 123,
    "title": "Titre de la note",
    "content": "Contenu de la note"
}
```

**Interface** :
- Bouton "Suggérer" à côté des tags
- Auto-suggestion lors de la création/modification d'une note (optionnel)

---

### 4. Notes Liées

**Description** : Trouve automatiquement des notes similaires/connexes à la note actuelle.

**Utilisation** :
```javascript
const relatedNotes = await AIAssistant.findRelatedNotes(noteId, {
    limit: 5,
    minSimilarity: 0.4
});
```

**API** : `POST /api/api_ai_related_notes.php`
```json
{
    "note_id": 123,
    "limit": 5,
    "min_similarity": 0.4
}
```

**Interface** :
- Panneau "Notes liées" affiché automatiquement dans la colonne droite
- Mise à jour automatique lors de l'ouverture d'une note

---

### 5. Extraction d'Informations

**Description** : Extrait des informations structurées (dates, tâches, personnes, sujets, mots-clés).

**Utilisation** :
```javascript
const extracted = await AIAssistant.extractInformation(noteId, content);
// Retourne: { dates: [], tasks: [], people: [], topics: [], keywords: [] }
```

**API** : `POST /api/api_ai_extract.php`
```json
{
    "note_id": 123,
    "content": "contenu optionnel si note_id fourni"
}
```

**Interface** :
- Accessible via le bouton "Information" de la note
- Affichage dans la modal d'information de la note

---

## 🔐 Sécurité et Rate Limiting

### Rate Limiting

Par défaut, chaque utilisateur peut faire **200 requêtes par jour** (configurable dans `ai_config.php`).

Le rate limiting est basé sur l'adresse IP. Pour une vraie application multi-utilisateurs, il faudrait utiliser l'ID utilisateur.

### Gestion des Erreurs

Toutes les APIs retournent des erreurs structurées :
```json
{
    "success": false,
    "message": "Description de l'erreur"
}
```

Codes HTTP :
- `200` : Succès
- `400` : Requête invalide
- `403` : Fonctionnalité désactivée
- `429` : Rate limit dépassé
- `500` : Erreur serveur

---

## 💰 Coûts OpenRouter

OpenRouter facture selon le modèle utilisé :

### Modèles Recommandés

- **Embeddings** : `text-embedding-3-small` (~$0.00002 par 1K tokens)
- **Génération** : `openai/gpt-3.5-turbo` (~$0.002 par 1K tokens)
- **Extraction** : `anthropic/claude-3-haiku` (~$0.00025 par 1K tokens)

### Estimation des Coûts

Pour 1000 notes avec utilisation quotidienne :
- **Embeddings initiaux** : ~$0.20 (une fois)
- **Recherches quotidiennes** : ~$0.01/jour
- **Génération de contenu** : ~$0.05-0.50 par utilisation
- **Tagging automatique** : ~$0.001 par note

**Total estimé** : ~$5-10/mois pour une utilisation modérée

---

## 🧪 Tests

### Test de Génération

```bash
curl -X POST http://localhost:8040/api/api_ai_generate.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{
    "action": "summarize",
    "content": "Ceci est un texte de test très long qui contient beaucoup d informations importantes sur différents sujets."
  }'
```

### Test de Recherche Sémantique

```bash
curl -X POST http://localhost:8040/api/api_ai_search.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mon sujet de recherche",
    "workspace": "Poznote",
    "limit": 5
  }'
```

### Test de Suggestion de Tags

```bash
curl -X POST http://localhost:8040/api/api_ai_suggest_tags.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ma note",
    "content": "Contenu de ma note avec des informations importantes"
  }'
```

---

## 🔄 Mise à Jour des Embeddings

Les embeddings doivent être régénérés si le contenu d'une note change significativement.

### Mise à jour automatique

Ajouter un hook dans `api_update_note.php` :

```php
// Après la mise à jour de la note
if (AIConfig::isFeatureEnabled('semantic_search')) {
    $embeddings = new AIEmbeddings($con);
    $embeddings->processNote($id, $heading, $entry);
}
```

### Mise à jour manuelle (batch)

```bash
curl -X POST http://localhost:8040/api/api_ai_process_embeddings.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{
    "action": "batch",
    "workspace": "Poznote",
    "limit": 1000
  }'
```

---

## 📊 Performance

### Optimisations

1. **Cache des embeddings** : Les embeddings sont stockés en base et réutilisés
2. **Rate limiting** : Limite les appels API pour éviter les coûts excessifs
3. **Traitement asynchrone** : Pour les grandes quantités, utiliser un traitement en arrière-plan

### Limitations

- **Taille des textes** : Limité à 8000 caractères pour les embeddings
- **Temps de réponse** : 1-3 secondes selon le modèle utilisé
- **Coûts** : Augmentent avec l'utilisation

---

## 🐛 Dépannage

### Erreur "API key not configured"

Vérifier que `OPENROUTER_API_KEY` est défini dans `.env` et redémarrer le conteneur.

### Erreur "Rate limit exceeded"

Attendre ou augmenter `RATE_LIMIT_PER_USER` dans `ai_config.php`.

### Embeddings non générés

Exécuter le script de traitement batch :
```bash
curl -X POST http://localhost:8040/api/api_ai_process_embeddings.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{"action": "batch"}'
```

### Fonctionnalités désactivées

Vérifier les paramètres dans la table `settings` :
```sql
SELECT * FROM settings WHERE key LIKE 'ai%';
```

---

## 📚 Ressources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [OpenRouter Models](https://openrouter.ai/models)
- [OpenRouter Pricing](https://openrouter.ai/docs/pricing)

---

## ✅ Checklist d'Installation

- [ ] Compte OpenRouter créé
- [ ] Clé API obtenue
- [ ] Variable `OPENROUTER_API_KEY` configurée dans `.env`
- [ ] Conteneur Docker redémarré
- [ ] Tables de base de données créées (automatique)
- [ ] Fonctionnalités activées dans Settings
- [ ] Embeddings générés pour les notes existantes
- [ ] Tests effectués

---

**Date de création** : 2025-12-18  
**Version** : 1.0.0

