# Guide de déploiement Poznote sur Railway

Ce guide explique comment déployer Poznote sur Railway, une plateforme cloud qui supporte Docker.

## Prérequis

- Un compte Railway (gratuit avec limitations)
- Un dépôt GitHub avec votre code Poznote
- Une clé API OpenRouter (optionnelle, pour les fonctionnalités IA)

## Étapes de déploiement

### 1. Créer un nouveau projet sur Railway

1. Allez sur [railway.app](https://railway.app)
2. Connectez-vous avec votre compte GitHub
3. Cliquez sur "New Project"
4. Sélectionnez "Deploy from GitHub repo"
5. Choisissez votre dépôt `poznote`

### 2. Configurer les variables d'environnement

Dans les paramètres du service Railway, ajoutez les variables suivantes :

#### Variables obligatoires :
```
POZNOTE_USERNAME=admin
POZNOTE_PASSWORD=votre_mot_de_passe_securise
SQLITE_DATABASE=/var/www/html/data/database/poznote.db
```

#### Variables optionnelles (pour les fonctionnalités IA) :
```
OPENROUTER_API_KEY=votre_cle_api_openrouter
AI_ENABLED=1
```

**Note** : Railway définit automatiquement la variable `PORT`, mais nginx écoute sur le port 80 à l'intérieur du conteneur. Railway mappe automatiquement ce port.

### 3. Configurer un volume persistant pour les données

**IMPORTANT** : Les données (notes, base de données SQLite) doivent être persistées.

1. Dans Railway, allez dans votre service
2. Cliquez sur "Volumes"
3. Ajoutez un nouveau volume :
   - **Mount Path** : `/var/www/html/data`
   - **Name** : `poznote-data`

Cela garantit que vos notes et votre base de données ne seront pas perdues lors des redéploiements.

### 4. Déployer

Railway détecte automatiquement le `Dockerfile` et déploie l'application.

1. Railway va construire l'image Docker
2. Une fois le build terminé, l'application sera accessible via l'URL fournie par Railway

### 5. Accéder à votre application

1. Railway génère automatiquement une URL (ex: `https://votre-projet.up.railway.app`)
2. Vous pouvez aussi configurer un domaine personnalisé dans les paramètres

## Configuration recommandée

### Plan Railway

- **Starter Plan** (gratuit) : 500 heures/mois, 512 MB RAM, 1 GB storage
- **Developer Plan** ($5/mois) : Plus de ressources, meilleures performances

### Sécurité

1. **Changez le mot de passe par défaut** : Utilisez un mot de passe fort pour `POZNOTE_PASSWORD`
2. **Activez HTTPS** : Railway fournit HTTPS automatiquement
3. **Sauvegardes** : Configurez des sauvegardes régulières du volume `/var/www/html/data`

### Sauvegardes

Pour sauvegarder vos données :

```bash
# Depuis votre machine locale, téléchargez le volume
railway volume download poznote-data
```

Ou utilisez la fonctionnalité de backup intégrée de Poznote via l'interface web.

## Dépannage

### Erreur réseau / Impossible de se connecter

Si vous voyez "erreur réseau" ou que l'application n'est pas accessible :

1. **Vérifiez que le déploiement est terminé** :
   - Attendez 2-3 minutes après le déploiement
   - Vérifiez que le build est en état "Deployed" (vert) dans Railway

2. **Vérifiez les logs Railway** :
   - Dans Railway, cliquez sur votre service → "Deployments" → "View Logs"
   - Cherchez les messages "nginx entered RUNNING state" et "php-fpm entered RUNNING state"
   - Si vous voyez ces messages, les services sont démarrés

3. **Vérifiez l'URL publique** :
   - Railway génère une URL automatiquement (ex: `https://votre-projet.up.railway.app`)
   - Cliquez sur "Settings" → "Networking" pour voir l'URL publique
   - Assurez-vous d'utiliser HTTPS (pas HTTP)

4. **Vérifiez les variables d'environnement** :
   - `POZNOTE_USERNAME` et `POZNOTE_PASSWORD` doivent être définis
   - `SQLITE_DATABASE` doit être `/var/www/html/data/database/poznote.db`

5. **Redéployez si nécessaire** :
   - Dans Railway, cliquez sur "Deployments" → "Redeploy"
   - Attendez la fin du redéploiement

### L'application ne démarre pas

1. Vérifiez les logs Railway : Dans Railway → Service → Deployments → View Logs
2. Vérifiez que toutes les variables d'environnement sont définies
3. Vérifiez que le volume est correctement monté
4. Cherchez les erreurs dans les logs (lignes en rouge)

### Les données sont perdues

- Assurez-vous que le volume persistant est monté sur `/var/www/html/data`
- Vérifiez que le volume n'a pas été supprimé accidentellement
- Vérifiez dans Railway → Service → Volumes que le volume existe

### Problèmes de permissions

Le script `init.sh` configure automatiquement les permissions. Si vous avez des problèmes :
1. Vérifiez les logs de démarrage (cherchez "Setting correct permissions")
2. Assurez-vous que le volume est monté avec les bonnes permissions
3. Si nécessaire, redéployez pour réinitialiser les permissions

## Mise à jour

Pour mettre à jour Poznote :

1. Poussez vos modifications sur GitHub
2. Railway détecte automatiquement les changements et redéploie
3. Les données dans le volume persistant sont préservées

## Support

- Documentation Railway : https://docs.railway.app
- Issues GitHub : https://github.com/seb59520/poznote/issues

