# 🎨 Guide : Interface de Configuration IA

## ✅ Interface Ajoutée

Une interface complète a été ajoutée dans **Settings** pour activer/désactiver les fonctionnalités IA.

---

## 📍 Accès

1. Ouvrez Poznote
2. Cliquez sur l'icône **Settings** (⚙️) dans la barre latérale
3. Cliquez sur la carte **"AI Features"** avec l'icône robot 🤖

---

## 🎛️ Fonctionnalités Configurables

L'interface permet de configurer 6 fonctionnalités :

### 1. **Activer l'IA** (Master Switch)
- Active/désactive toutes les fonctionnalités IA
- Si désactivé, toutes les autres fonctionnalités sont automatiquement désactivées

### 2. **Recherche sémantique**
- Trouver des notes similaires même sans mots-clés exacts
- Nécessite que les embeddings soient générés

### 3. **Génération de contenu**
- Résumer, développer et réécrire du texte
- Boutons dans la toolbar et slash commands

### 4. **Tagging automatique**
- Suggérer des tags pertinents
- Bouton "Suggérer" à côté des tags

### 5. **Notes liées**
- Trouver automatiquement des notes similaires
- Panneau automatique dans la colonne droite

### 6. **Extraction d'informations**
- Extraire dates, tâches, personnes, sujets
- Accessible via l'API

---

## 🎨 Interface

### Badge de Statut

Dans la carte "AI Features", un badge affiche le statut :
- **"activé"** (vert) : L'IA est activée
- **"désactivé"** (rouge) : L'IA est désactivée

### Modal de Configuration

En cliquant sur la carte, une modal s'ouvre avec :
- **6 switches** pour chaque fonctionnalité
- **Description** de chaque fonctionnalité
- **Note informative** sur la configuration OpenRouter
- **Sauvegarde automatique** lors du changement

### Comportement des Switches

- Si **"Activer l'IA"** est désactivé, tous les autres switches sont désactivés (grisés)
- Si **"Activer l'IA"** est activé, tous les autres switches deviennent actifs
- Chaque fonctionnalité peut être activée/désactivée indépendamment

---

## 🔧 Utilisation

### Activer l'IA

1. Ouvrez Settings → AI Features
2. Activez le switch **"Activer l'IA"**
3. Activez les fonctionnalités souhaitées
4. Les changements sont sauvegardés automatiquement

### Désactiver l'IA

1. Ouvrez Settings → AI Features
2. Désactivez le switch **"Activer l'IA"**
3. Une confirmation vous sera demandée
4. Toutes les fonctionnalités seront désactivées

---

## ⚠️ Prérequis

Pour que les fonctionnalités fonctionnent, vous devez :

1. **Avoir une clé API OpenRouter**
   - Créer un compte sur [OpenRouter.ai](https://openrouter.ai)
   - Obtenir votre clé API

2. **Configurer la clé dans `.env`**
   ```bash
   OPENROUTER_API_KEY=votre_cle_api
   AI_ENABLED=1
   ```

3. **Redémarrer le conteneur**
   ```bash
   docker compose -f docker-compose-dev.yml restart
   ```

4. **Générer les embeddings** (pour la recherche sémantique)
   ```bash
   ./generate_embeddings.sh
   ```

---

## 🐛 Dépannage

### La modal ne s'ouvre pas

- Vérifiez que `js/ai-settings.js` est chargé
- Ouvrez la console du navigateur (F12) pour voir les erreurs

### Les switches ne fonctionnent pas

- Vérifiez que l'API `api_settings.php` est accessible
- Vérifiez les erreurs dans la console du navigateur

### Les changements ne sont pas sauvegardés

- Vérifiez que vous êtes authentifié
- Vérifiez les permissions de la base de données

### Le badge affiche toujours "loading..."

- Vérifiez que l'API `api_settings.php` répond correctement
- Vérifiez les erreurs dans la console du navigateur

---

## 📝 Notes Techniques

- Les paramètres sont stockés dans la table `settings` de la base de données
- Les clés sont : `ai_enabled`, `ai_feature_*`
- Les valeurs sont `'1'` pour activé, `'0'` pour désactivé
- L'API utilisée est `api_settings.php` (déjà existante)

---

## ✅ Checklist

- [ ] Interface visible dans Settings
- [ ] Badge de statut fonctionnel
- [ ] Modal s'ouvre au clic
- [ ] Switches fonctionnent
- [ ] Sauvegarde automatique fonctionne
- [ ] Prérequis OpenRouter configurés
- [ ] Embeddings générés (si recherche sémantique activée)

---

**L'interface est maintenant disponible dans Settings !** 🎉

