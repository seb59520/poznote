# 🔧 Activation de l'IA - Guide Rapide

## Problème résolu ✅

Les fichiers API ont été corrigés pour fonctionner avec la structure Docker. Le chemin était incorrect.

## Étapes pour activer l'IA

### 1. Ajouter la clé API OpenRouter dans `.env`

```bash
# Ajouter cette ligne dans .env
OPENROUTER_API_KEY=votre_cle_api_openrouter_ici
AI_ENABLED=1
```

### 2. Redémarrer le conteneur

```bash
docker compose -f docker-compose-dev.yml restart
```

### 3. Activer les fonctionnalités dans la base de données

```bash
docker compose -f docker-compose-dev.yml exec webserver sqlite3 /var/www/html/data/database/poznote.db "
UPDATE settings SET value = '1' WHERE key = 'ai_enabled';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_semantic_search';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_generation';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_tagging';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_related_notes';
UPDATE settings SET value = '1' WHERE key = 'ai_feature_extraction';
"
```

### 4. Générer les embeddings

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

Ou utiliser le script :

```bash
./generate_embeddings.sh
```

## ✅ Vérification

Testez que tout fonctionne :

```bash
curl -X POST http://localhost:8040/api/api_ai_process_embeddings.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{"action": "batch", "limit": 1}'
```

Vous devriez voir :
```json
{"success":true,"processed":1,"errors":0,"workspace":null,"limit":1}
```

## 📝 Note importante

**Utilisez `docker-compose-dev.yml`** au lieu de `docker-compose.yml` pour que les fichiers locaux soient montés dans le conteneur :

```bash
docker compose -f docker-compose-dev.yml up -d
```

