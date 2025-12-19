#!/bin/bash

# Script pour générer les embeddings de toutes les notes
# Usage: ./generate_embeddings.sh [workspace] [limit]

# Configuration
POZNOTE_URL="${POZNOTE_URL:-http://localhost:8040}"
POZNOTE_USER="${POZNOTE_USER:-admin}"
POZNOTE_PASS="${POZNOTE_PASS:-admin123!}"
WORKSPACE="${1:-Poznote}"
LIMIT="${2:-1000}"

echo "=== Génération des embeddings ==="
echo "URL: $POZNOTE_URL"
echo "Workspace: $WORKSPACE"
echo "Limit: $LIMIT"
echo ""

# Vérifier que l'IA est activée
echo "Vérification de l'activation de l'IA..."
response=$(curl -s -u "$POZNOTE_USER:$POZNOTE_PASS" \
  "$POZNOTE_URL/api/api_ai_process_embeddings.php" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "batch", "workspace": "'"$WORKSPACE"'", "limit": 1}')

if echo "$response" | grep -q '"success":false'; then
    echo "❌ Erreur: L'IA n'est peut-être pas activée ou la clé API n'est pas configurée"
    echo "Réponse: $response"
    exit 1
fi

# Générer les embeddings
echo "Génération des embeddings pour les notes..."
response=$(curl -s -u "$POZNOTE_USER:$POZNOTE_PASS" \
  "$POZNOTE_URL/api/api_ai_process_embeddings.php" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"action": "batch", "workspace": "'"$WORKSPACE"'", "limit": '"$LIMIT"'}')

# Afficher le résultat
if echo "$response" | grep -q '"success":true'; then
    processed=$(echo "$response" | grep -o '"processed":[0-9]*' | grep -o '[0-9]*')
    errors=$(echo "$response" | grep -o '"errors":[0-9]*' | grep -o '[0-9]*')
    
    echo "✅ Génération terminée!"
    echo "   Notes traitées: $processed"
    echo "   Erreurs: $errors"
else
    echo "❌ Erreur lors de la génération"
    echo "Réponse: $response"
    exit 1
fi

echo ""
echo "Les embeddings sont maintenant disponibles pour la recherche sémantique!"

