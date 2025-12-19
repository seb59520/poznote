# ⚙️ Guide : Configuration de la Limite de Requêtes IA

## 📊 Limite de Rate Limiting

La limite de requêtes IA par jour peut maintenant être configurée depuis l'interface Settings.

---

## 🎯 Configuration

### Via l'Interface (Recommandé)

1. Ouvrez **Settings** → **AI Features**
2. Dans la modal, trouvez la section **"Limite de requêtes par jour"**
3. Modifiez la valeur (entre 10 et 10000)
4. Cliquez sur **"Enregistrer"**

### Via SQL (Alternative)

```sql
UPDATE settings SET value = '500' WHERE key = 'ai_rate_limit';
```

### Valeurs Recommandées

- **Usage personnel léger** : 100-200 requêtes/jour
- **Usage personnel normal** : 200-500 requêtes/jour
- **Usage intensif** : 500-1000 requêtes/jour
- **Usage professionnel** : 1000-5000 requêtes/jour
- **Maximum** : 10000 requêtes/jour

---

## 🔍 Comment ça Fonctionne

### Système de Rate Limiting

- **Par IP** : La limite est appliquée par adresse IP
- **Par jour** : Le compteur se réinitialise chaque jour à minuit
- **Toutes les fonctionnalités** : La limite s'applique à toutes les requêtes IA

### Comptage

Chaque requête IA compte pour 1 :
- Génération de contenu (résumé, expansion, réécriture)
- Recherche sémantique
- Suggestion de tags
- Notes liées
- Extraction d'informations
- Création de notes avec IA

### Table de Suivi

Les requêtes sont enregistrées dans la table `ai_rate_limits` :
- `identifier` : Adresse IP
- `date` : Date (YYYY-MM-DD)
- `count` : Nombre de requêtes
- `last_request` : Dernière requête

---

## 📊 Vérifier l'Utilisation

### Via SQL

```sql
-- Voir les requêtes d'aujourd'hui
SELECT identifier, count, last_request 
FROM ai_rate_limits 
WHERE date = date('now');

-- Voir la limite configurée
SELECT value FROM settings WHERE key = 'ai_rate_limit';

-- Voir l'historique
SELECT date, identifier, count 
FROM ai_rate_limits 
ORDER BY date DESC 
LIMIT 10;
```

### Via l'Interface

La limite configurée est affichée dans Settings → AI Features.

---

## ⚠️ Dépannage

### Erreur "Rate limit exceeded"

**Solution** :
1. Augmenter la limite dans Settings → AI Features
2. Attendre jusqu'à minuit (réinitialisation quotidienne)
3. Vérifier l'utilisation actuelle via SQL

### Réinitialiser le Compteur

Pour réinitialiser manuellement le compteur d'une IP :

```sql
DELETE FROM ai_rate_limits WHERE identifier = 'VOTRE_IP' AND date = date('now');
```

Pour réinitialiser tous les compteurs :

```sql
DELETE FROM ai_rate_limits WHERE date = date('now');
```

---

## 🔧 Configuration Avancée

### Modifier la Valeur par Défaut

Dans `src/ai/ai_config.php` :

```php
const RATE_LIMIT_PER_USER_DEFAULT = 500; // Au lieu de 200
```

### Désactiver le Rate Limiting

Pour désactiver complètement (non recommandé) :

```sql
UPDATE settings SET value = '999999' WHERE key = 'ai_rate_limit';
```

Ou modifier le code pour toujours retourner `true` dans `checkRateLimit()`.

---

## 📈 Statistiques d'Utilisation

### Script de Monitoring

```bash
# Voir les statistiques d'aujourd'hui
docker compose -f docker-compose-dev.yml exec webserver sqlite3 \
  /var/www/html/data/database/poznote.db \
  "SELECT identifier, count, last_request FROM ai_rate_limits WHERE date = date('now');"
```

### Alertes

Vous pouvez créer un script pour vous alerter si la limite est proche :

```bash
#!/bin/bash
LIMIT=$(docker compose -f docker-compose-dev.yml exec webserver sqlite3 \
  /var/www/html/data/database/poznote.db \
  "SELECT value FROM settings WHERE key = 'ai_rate_limit';")

CURRENT=$(docker compose -f docker-compose-dev.yml exec webserver sqlite3 \
  /var/www/html/data/database/poznote.db \
  "SELECT SUM(count) FROM ai_rate_limits WHERE date = date('now');")

PERCENTAGE=$((CURRENT * 100 / LIMIT))

if [ $PERCENTAGE -gt 80 ]; then
    echo "⚠️  Rate limit à ${PERCENTAGE}% (${CURRENT}/${LIMIT})"
fi
```

---

## ✅ Checklist

- [ ] Limite configurée dans Settings
- [ ] Valeur appropriée selon votre usage
- [ ] Compréhension du système de comptage
- [ ] Monitoring en place (optionnel)

---

**La limite est maintenant configurable depuis Settings → AI Features !** ⚙️

