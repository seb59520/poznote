# 🔧 Dépannage : Ne Vois Pas les Changements

## ✅ Vérifications Effectuées

Tous les fichiers sont bien présents dans le conteneur :
- ✅ `ai-assistant.js` - Présent
- ✅ `ai-integration.js` - Présent  
- ✅ `ai-settings.js` - Présent
- ✅ `api_ai_create_note.php` - Présent
- ✅ Modifications dans `modals.php` - Présentes
- ✅ Fonction `createAINote()` - Présente

---

## 🔄 Solutions à Essayer

### 1. Vider le Cache du Navigateur

**Chrome/Edge :**
- Appuyez sur `Ctrl+Shift+R` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
- Ou : `F12` → Onglet "Network" → Cochez "Disable cache" → Rechargez

**Firefox :**
- Appuyez sur `Ctrl+F5` (Windows/Linux) ou `Cmd+Shift+R` (Mac)
- Ou : `F12` → Onglet "Network" → Clic droit → "Empty Cache and Hard Reload"

**Safari :**
- `Cmd+Option+R` pour recharger sans cache
- Ou : Menu Développer → Vider les caches

---

### 2. Vérifier que l'IA est Activée

1. Allez dans **Settings** → **AI Features**
2. Vérifiez que le switch **"Activer l'IA"** est activé
3. Si ce n'est pas le cas, activez-le

---

### 3. Vérifier la Console du Navigateur

Ouvrez la console (`F12`) et vérifiez s'il y a des erreurs :

```javascript
// Vérifier que AIAssistant est chargé
console.log(typeof window.AIAssistant);

// Devrait afficher : "object"
```

Si vous voyez `undefined`, les fichiers JavaScript ne sont pas chargés.

---

### 4. Vérifier les Fichiers dans le Navigateur

Ouvrez la console (`F12`) → Onglet "Network" → Rechargez la page

Vérifiez que ces fichiers se chargent :
- `ai-assistant.js` → Status 200
- `ai-integration.js` → Status 200
- `ai-settings.js` → Status 200 (sur settings.php)

---

### 5. Vérifier l'Option "Note avec IA"

L'option "Note avec IA" dans le modal de création est **cachée par défaut** (`display: none`).

Elle s'affiche automatiquement si :
- `window.AIAssistant` est défini (fichiers JS chargés)
- L'IA est activée dans Settings

**Pour vérifier manuellement :**

Ouvrez la console (`F12`) et tapez :

```javascript
// Vérifier que l'option existe
const aiOption = document.getElementById('aiCreateOption');
console.log(aiOption);

// Afficher l'option manuellement (pour test)
if (aiOption) {
    aiOption.style.display = 'flex';
}
```

---

### 6. Forcer le Rechargement des Fichiers

Les fichiers JavaScript ont un paramètre de version (`?v=...`). Pour forcer le rechargement :

1. Ouvrez `src/index.php`
2. Modifiez la ligne avec `$v` (généralement vers la ligne 100)
3. Changez la valeur de `$v` pour forcer le rechargement

Ou directement dans le navigateur, ajoutez un paramètre de cache-busting :

```
http://localhost:8040/index.php?v=12345
```

---

### 7. Vérifier les Permissions

Vérifiez que les fichiers sont accessibles :

```bash
# Dans le conteneur
docker compose -f docker-compose-dev.yml exec webserver ls -la /var/www/html/js/ai-*.js

# Devrait afficher les fichiers avec permissions rw-r--r--
```

---

### 8. Redémarrer le Conteneur

Parfois, un redémarrage complet aide :

```bash
docker compose -f docker-compose-dev.yml down
docker compose -f docker-compose-dev.yml up -d
```

---

## 🎯 Test Rapide

### Test 1 : Vérifier l'API

```bash
curl -X POST http://localhost:8040/api/api_ai_create_note.php \
  -u admin:admin123! \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test", "type": "structured", "workspace": "Poznote"}'
```

**Résultat attendu :** JSON avec `success: true` ou `success: false` avec un message

### Test 2 : Vérifier Settings

1. Allez sur `http://localhost:8040/settings.php`
2. Cherchez la carte **"AI Features"**
3. Cliquez dessus
4. Une modal devrait s'ouvrir avec les switches

### Test 3 : Vérifier le Modal de Création

1. Cliquez sur le bouton **"+"** dans la barre latérale
2. Le modal de création s'ouvre
3. Si l'IA est activée, vous devriez voir **"Note avec IA"**

---

## 🐛 Erreurs Courantes

### "AIAssistant is not defined"

**Cause :** Les fichiers JavaScript ne sont pas chargés

**Solution :**
1. Vérifiez la console pour les erreurs 404
2. Videz le cache du navigateur
3. Vérifiez que `ai-assistant.js` est bien dans `src/js/`

### L'option "Note avec IA" n'apparaît pas

**Cause :** L'IA n'est pas activée ou `AIAssistant` n'est pas défini

**Solution :**
1. Activez l'IA dans Settings → AI Features
2. Vérifiez la console : `console.log(typeof window.AIAssistant)`
3. Rechargez la page après activation

### "Rate limit exceeded"

**Cause :** Trop de requêtes aujourd'hui

**Solution :**
1. Augmentez la limite dans Settings → AI Features
2. Ou attendez jusqu'à minuit (réinitialisation quotidienne)

---

## 📞 Si Rien Ne Fonctionne

1. **Vérifiez les logs du conteneur :**
   ```bash
   docker compose -f docker-compose-dev.yml logs webserver | tail -50
   ```

2. **Vérifiez que le volume est bien monté :**
   ```bash
   docker compose -f docker-compose-dev.yml exec webserver ls -la /var/www/html/js/ai-*.js
   ```

3. **Vérifiez les permissions :**
   ```bash
   ls -la src/js/ai-*.js
   ```

---

**Essayez d'abord de vider le cache du navigateur (Ctrl+Shift+R) !** 🔄

