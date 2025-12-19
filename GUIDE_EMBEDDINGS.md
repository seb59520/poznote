# Guide : Génération des Embeddings

Les embeddings sont des représentations vectorielles de vos notes qui permettent la recherche sémantique. Ce guide explique comment les générer.

---

## 🎯 Pourquoi générer les embeddings ?

Les embeddings permettent de :
- ✅ Trouver des notes similaires même sans mots-clés exacts
- ✅ Utiliser la recherche sémantique
- ✅ Voir les notes liées automatiquement

**Important** : Les embeddings doivent être générés **une fois** pour chaque note, puis mis à jour si le contenu change significativement.

---

## 📋 Prérequis

1. **OpenRouter configuré** :
   ```bash
   # Vérifier dans .env
   OPENROUTER_API_KEY=votre_cle_api
   AI_ENABLED=1
   ```

2. **Fonctionnalités activées** :
   ```sql
   UPDATE settings SET value = '1' WHERE key = 'ai_enabled';
   UPDATE settings SET value = '1' WHERE key = 'ai_feature_semantic_search';
   ```

3. **Redémarrer le conteneur** :
   ```bash
   docker compose restart
   ```

---

## 🚀 Méthode 1 : Script automatique (Recommandé)

Un script bash est disponible pour faciliter la génération :

```bash
# Générer pour toutes les notes du workspace "Poznote"
./generate_embeddings.sh

# Générer pour un workspace spécifique
./generate_embeddings.sh "MonWorkspace"

# Limiter le nombre de notes (pour tester)
./generate_embeddings.sh "Poznote" 100
```

Le script affichera :
- ✅ Le nombre de notes traitées
- ❌ Le nombre d'erreurs (le cas échéant)

---

## 🚀 Méthode 2 : Via curl (Ligne de commande)

### Générer pour toutes les notes

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

### Générer pour une note spécifique

```bash
curl -X POST http://localhost:8040/api/api_ai_process_embeddings.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{
    "action": "single",
    "note_id": 123
  }'
```

### Paramètres

- `action` : `"batch"` pour toutes les notes, `"single"` pour une note
- `workspace` : Nom du workspace (optionnel, traite tous les workspaces si omis)
- `limit` : Nombre maximum de notes à traiter (par défaut: 1000)
- `note_id` : ID de la note (requis pour `"single"`)

---

## 🚀 Méthode 3 : Via l'API depuis JavaScript

```javascript
// Générer l'embedding d'une note spécifique
fetch('api/api_ai_process_embeddings.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
    },
    credentials: 'same-origin',
    body: JSON.stringify({
        action: 'single',
        note_id: 123
    })
})
.then(response => response.json())
.then(data => {
    if (data.success) {
        console.log('Embedding généré avec succès');
    }
});
```

---

## 📊 Vérifier les embeddings générés

### Via SQL

```sql
-- Compter les embeddings générés
SELECT COUNT(*) FROM note_embeddings;

-- Voir les dernières notes traitées
SELECT ne.note_id, e.heading, ne.updated_at 
FROM note_embeddings ne
JOIN entries e ON ne.note_id = e.id
ORDER BY ne.updated_at DESC
LIMIT 10;
```

### Via l'API

```bash
# Vérifier qu'une note a un embedding
curl -X POST http://localhost:8040/api/api_ai_related_notes.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{"note_id": 123}'
```

Si la note a un embedding, l'API retournera des notes liées. Sinon, elle générera l'embedding automatiquement.

---

## 🔄 Mise à jour automatique (À implémenter)

Pour l'instant, les embeddings doivent être régénérés manuellement après une modification importante d'une note.

**Option future** : Ajouter un hook dans `api_update_note.php` pour régénérer automatiquement :

```php
// Après la mise à jour de la note
if (AIConfig::isFeatureEnabled('semantic_search')) {
    $embeddings = new AIEmbeddings($con);
    $embeddings->processNote($id, $heading, $entry);
}
```

---

## ⚠️ Notes importantes

### Coûts

- Chaque embedding coûte ~$0.00002 (très peu cher)
- Pour 1000 notes : ~$0.20
- Les embeddings sont mis en cache, pas besoin de les régénérer à chaque fois

### Performance

- Génération : ~1-2 secondes par note
- Pour 1000 notes : ~15-30 minutes
- Le script fait une petite pause entre chaque note pour éviter de surcharger l'API

### Taille des textes

- Les textes sont limités à 8000 caractères pour les embeddings
- Les textes plus longs sont automatiquement tronqués

---

## 🐛 Dépannage

### Erreur "API key not configured"

Vérifier que `OPENROUTER_API_KEY` est défini dans `.env` et redémarrer :

```bash
docker compose restart
```

### Erreur "AI features are disabled"

Activer l'IA :

```sql
UPDATE settings SET value = '1' WHERE key = 'ai_enabled';
```

### Erreur "Rate limit exceeded"

Attendre ou augmenter la limite dans `src/ai/ai_config.php` :

```php
const RATE_LIMIT_PER_USER = 500; // Au lieu de 200
```

### Aucun embedding généré

Vérifier les logs :

```bash
docker compose logs webserver | grep -i embedding
```

---

## 📈 Statistiques

Après la génération, vous pouvez voir les statistiques :

```sql
-- Nombre total d'embeddings
SELECT COUNT(*) as total FROM note_embeddings;

-- Notes sans embeddings
SELECT COUNT(*) as sans_embedding
FROM entries e
LEFT JOIN note_embeddings ne ON e.id = ne.note_id
WHERE e.trash = 0 AND ne.note_id IS NULL;

-- Dernière mise à jour
SELECT MAX(updated_at) as derniere_maj FROM note_embeddings;
```

---

## ✅ Checklist

- [ ] OpenRouter API key configurée
- [ ] IA activée dans les settings
- [ ] Conteneur redémarré
- [ ] Embeddings générés (script ou curl)
- [ ] Vérification que les embeddings sont créés
- [ ] Test de recherche sémantique fonctionnel

---

## 🎯 Exemple complet

```bash
# 1. Vérifier la configuration
cat .env | grep OPENROUTER_API_KEY

# 2. Activer l'IA (si pas déjà fait)
docker compose exec webserver php -r "
require 'src/db_connect.php';
\$con->exec(\"UPDATE settings SET value = '1' WHERE key = 'ai_enabled'\");
\$con->exec(\"UPDATE settings SET value = '1' WHERE key = 'ai_feature_semantic_search'\");
echo 'IA activée\n';
"

# 3. Générer les embeddings
./generate_embeddings.sh

# 4. Vérifier
docker compose exec webserver sqlite3 data/database/poznote.db \
  "SELECT COUNT(*) FROM note_embeddings;"
```

---

**C'est tout ! Vos embeddings sont maintenant générés et la recherche sémantique est disponible.** 🎉

