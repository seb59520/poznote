# Exemple d'Implémentation IA pour Poznote

Ce document fournit des exemples concrets d'implémentation pour intégrer l'IA dans Poznote.

---

## 📁 Structure de Fichiers

```
src/
├── ai/
│   ├── ai_config.php
│   ├── ai_embeddings.php
│   └── ai_generator.php
├── api/
│   ├── api_ai_generate.php
│   └── api_ai_search.php
└── js/
    └── ai-assistant.js
```

---

## 1. Configuration IA (`src/ai/ai_config.php`)

```php
<?php
/**
 * Configuration pour les fonctionnalités IA
 */

class AIConfig {
    // Type d'implémentation : 'openai', 'ollama', 'huggingface', 'disabled'
    const PROVIDER = 'openai';
    
    // Clés API (à définir dans les variables d'environnement)
    const OPENAI_API_KEY = null; // Sera lu depuis $_ENV
    const OPENAI_MODEL = 'gpt-3.5-turbo';
    const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
    
    // Configuration Ollama (si utilisé localement)
    const OLLAMA_URL = 'http://localhost:11434';
    const OLLAMA_MODEL = 'llama2';
    
    // Limites et cache
    const MAX_TOKENS = 500;
    const CACHE_TTL = 3600; // 1 heure
    const RATE_LIMIT_PER_USER = 100; // Requêtes par jour
    
    /**
     * Obtenir la clé API depuis les variables d'environnement
     */
    public static function getApiKey() {
        return $_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?? null;
    }
    
    /**
     * Vérifier si l'IA est activée
     */
    public static function isEnabled() {
        global $con;
        try {
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['ai_enabled']);
            $enabled = $stmt->fetchColumn();
            return $enabled === '1' || $enabled === 'true';
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Vérifier si une fonctionnalité IA spécifique est activée
     */
    public static function isFeatureEnabled($feature) {
        global $con;
        try {
            $stmt = $con->prepare('SELECT value FROM settings WHERE key = ?');
            $stmt->execute(['ai_feature_' . $feature]);
            $enabled = $stmt->fetchColumn();
            return $enabled === '1' || $enabled === 'true';
        } catch (Exception $e) {
            return false;
        }
    }
}
```

---

## 2. Gestion des Embeddings (`src/ai/ai_embeddings.php`)

```php
<?php
/**
 * Gestion des embeddings vectoriels pour la recherche sémantique
 */

require_once __DIR__ . '/ai_config.php';

class AIEmbeddings {
    private $con;
    
    public function __construct($databaseConnection) {
        $this->con = $databaseConnection;
        $this->ensureTableExists();
    }
    
    /**
     * Créer la table pour stocker les embeddings si elle n'existe pas
     */
    private function ensureTableExists() {
        $this->con->exec("
            CREATE TABLE IF NOT EXISTS note_embeddings (
                note_id INTEGER PRIMARY KEY,
                embedding TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES entries(id) ON DELETE CASCADE
            )
        ");
        
        // Index pour la recherche (SQLite ne supporte pas les index vectoriels natifs,
        // mais on peut utiliser des extensions comme sqlite-vss)
        $this->con->exec("
            CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON note_embeddings(updated_at)
        ");
    }
    
    /**
     * Générer un embedding pour une note
     */
    public function generateEmbedding($noteId, $title, $content) {
        $text = $title . "\n\n" . strip_tags($content);
        $text = mb_substr($text, 0, 8000); // Limiter la longueur
        
        if (AIConfig::PROVIDER === 'openai') {
            return $this->generateOpenAIEmbedding($text);
        } elseif (AIConfig::PROVIDER === 'ollama') {
            return $this->generateOllamaEmbedding($text);
        }
        
        return null;
    }
    
    /**
     * Générer un embedding via OpenAI
     */
    private function generateOpenAIEmbedding($text) {
        $apiKey = AIConfig::getApiKey();
        if (!$apiKey) {
            throw new Exception('OpenAI API key not configured');
        }
        
        $ch = curl_init('https://api.openai.com/v1/embeddings');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => AIConfig::OPENAI_EMBEDDING_MODEL,
                'input' => $text
            ])
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('OpenAI API error: ' . $response);
        }
        
        $data = json_decode($response, true);
        return $data['data'][0]['embedding'] ?? null;
    }
    
    /**
     * Générer un embedding via Ollama (modèle local)
     */
    private function generateOllamaEmbedding($text) {
        // Note: Ollama nécessite un modèle spécialisé pour les embeddings
        // Exemple avec nomic-embed-text
        $ch = curl_init(AIConfig::OLLAMA_URL . '/api/embeddings');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'model' => 'nomic-embed-text',
                'prompt' => $text
            ])
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $data = json_decode($response, true);
        return $data['embedding'] ?? null;
    }
    
    /**
     * Sauvegarder un embedding dans la base de données
     */
    public function saveEmbedding($noteId, $embedding) {
        $embeddingJson = json_encode($embedding);
        $model = AIConfig::PROVIDER === 'openai' 
            ? AIConfig::OPENAI_EMBEDDING_MODEL 
            : 'ollama';
        
        $stmt = $this->con->prepare("
            INSERT OR REPLACE INTO note_embeddings 
            (note_id, embedding, model, updated_at) 
            VALUES (?, ?, ?, datetime('now'))
        ");
        
        return $stmt->execute([$noteId, $embeddingJson, $model]);
    }
    
    /**
     * Récupérer l'embedding d'une note
     */
    public function getEmbedding($noteId) {
        $stmt = $this->con->prepare("
            SELECT embedding FROM note_embeddings WHERE note_id = ?
        ");
        $stmt->execute([$noteId]);
        $result = $stmt->fetchColumn();
        
        return $result ? json_decode($result, true) : null;
    }
    
    /**
     * Calculer la similarité cosinus entre deux embeddings
     */
    public function cosineSimilarity($embedding1, $embedding2) {
        if (count($embedding1) !== count($embedding2)) {
            return 0;
        }
        
        $dotProduct = 0;
        $norm1 = 0;
        $norm2 = 0;
        
        for ($i = 0; $i < count($embedding1); $i++) {
            $dotProduct += $embedding1[$i] * $embedding2[$i];
            $norm1 += $embedding1[$i] * $embedding1[$i];
            $norm2 += $embedding2[$i] * $embedding2[$i];
        }
        
        $denominator = sqrt($norm1) * sqrt($norm2);
        return $denominator > 0 ? $dotProduct / $denominator : 0;
    }
    
    /**
     * Rechercher des notes similaires
     */
    public function findSimilarNotes($queryEmbedding, $limit = 10, $workspace = null) {
        // Récupérer tous les embeddings
        $query = "SELECT note_id, embedding FROM note_embeddings";
        $params = [];
        
        if ($workspace) {
            $query .= " INNER JOIN entries ON note_embeddings.note_id = entries.id 
                       WHERE entries.workspace = ? AND entries.trash = 0";
            $params[] = $workspace;
        }
        
        $stmt = $this->con->prepare($query);
        $stmt->execute($params);
        
        $similarities = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $embedding = json_decode($row['embedding'], true);
            $similarity = $this->cosineSimilarity($queryEmbedding, $embedding);
            $similarities[] = [
                'note_id' => $row['note_id'],
                'similarity' => $similarity
            ];
        }
        
        // Trier par similarité décroissante
        usort($similarities, function($a, $b) {
            return $b['similarity'] <=> $a['similarity'];
        });
        
        return array_slice($similarities, 0, $limit);
    }
}
```

---

## 3. Génération de Contenu (`src/ai/ai_generator.php`)

```php
<?php
/**
 * Génération de contenu avec IA
 */

require_once __DIR__ . '/ai_config.php';

class AIGenerator {
    
    /**
     * Générer du contenu avec OpenAI
     */
    public static function generate($prompt, $maxTokens = null) {
        if (!AIConfig::isEnabled()) {
            throw new Exception('AI features are disabled');
        }
        
        $apiKey = AIConfig::getApiKey();
        if (!$apiKey) {
            throw new Exception('OpenAI API key not configured');
        }
        
        $maxTokens = $maxTokens ?? AIConfig::MAX_TOKENS;
        
        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => AIConfig::OPENAI_MODEL,
                'messages' => [
                    ['role' => 'system', 'content' => 'You are a helpful writing assistant.'],
                    ['role' => 'user', 'content' => $prompt]
                ],
                'max_tokens' => $maxTokens,
                'temperature' => 0.7
            ])
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new Exception('OpenAI API error: ' . $response);
        }
        
        $data = json_decode($response, true);
        return $data['choices'][0]['message']['content'] ?? '';
    }
    
    /**
     * Résumer une note
     */
    public static function summarize($content) {
        $prompt = "Résume le texte suivant en 2-3 phrases:\n\n" . strip_tags($content);
        return self::generate($prompt, 150);
    }
    
    /**
     * Développer un texte
     */
    public static function expand($text) {
        $prompt = "Développe et enrichis le texte suivant en un paragraphe complet:\n\n" . $text;
        return self::generate($prompt, 300);
    }
    
    /**
     * Réécrire un texte
     */
    public static function rewrite($text, $style = 'professional') {
        $stylePrompts = [
            'professional' => 'Réécris ce texte dans un style professionnel:',
            'casual' => 'Réécris ce texte dans un style décontracté:',
            'concise' => 'Réécris ce texte de manière plus concise:',
            'detailed' => 'Réécris ce texte avec plus de détails:'
        ];
        
        $prompt = ($stylePrompts[$style] ?? $stylePrompts['professional']) . "\n\n" . $text;
        return self::generate($prompt, 500);
    }
    
    /**
     * Suggérer des tags
     */
    public static function suggestTags($title, $content) {
        $text = $title . "\n\n" . strip_tags($content);
        $prompt = "Extrais 3-5 mots-clés pertinents (tags) pour ce texte. Réponds uniquement avec les tags séparés par des virgules:\n\n" . $text;
        $response = self::generate($prompt, 50);
        
        // Nettoyer et formater les tags
        $tags = array_map('trim', explode(',', $response));
        $tags = array_filter($tags, function($tag) {
            return !empty($tag) && strlen($tag) < 50;
        });
        
        return array_slice($tags, 0, 5);
    }
}
```

---

## 4. API de Génération (`src/api/api_ai_generate.php`)

```php
<?php
/**
 * API pour la génération de contenu avec IA
 */

require 'auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once 'config.php';
require_once __DIR__ . '/../ai/ai_generator.php';
require_once __DIR__ . '/../ai/ai_config.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'AI features are disabled']);
    exit;
}

// Seulement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$action = $input['action'] ?? '';
$content = $input['content'] ?? '';
$style = $input['style'] ?? 'professional';

try {
    $result = '';
    
    switch ($action) {
        case 'summarize':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            $result = AIGenerator::summarize($content);
            break;
            
        case 'expand':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            $result = AIGenerator::expand($content);
            break;
            
        case 'rewrite':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            $result = AIGenerator::rewrite($content, $style);
            break;
            
        case 'suggest_tags':
            $title = $input['title'] ?? '';
            $result = AIGenerator::suggestTags($title, $content);
            break;
            
        default:
            throw new Exception('Invalid action');
    }
    
    echo json_encode([
        'success' => true,
        'result' => $result
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
```

---

## 5. API de Recherche Sémantique (`src/api/api_ai_search.php`)

```php
<?php
/**
 * API pour la recherche sémantique
 */

require 'auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once 'config.php';
require_once __DIR__ . '/../ai/ai_embeddings.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once 'db_connect.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled() || !AIConfig::isFeatureEnabled('semantic_search')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Semantic search is disabled']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$query = $input['query'] ?? '';
$workspace = $input['workspace'] ?? null;
$limit = isset($input['limit']) ? intval($input['limit']) : 10;

if (empty($query)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Query is required']);
    exit;
}

try {
    $embeddings = new AIEmbeddings($con);
    
    // Générer l'embedding de la requête
    $queryEmbedding = $embeddings->generateEmbedding(0, $query, '');
    
    if (!$queryEmbedding) {
        throw new Exception('Failed to generate query embedding');
    }
    
    // Trouver les notes similaires
    $similarNotes = $embeddings->findSimilarNotes($queryEmbedding, $limit, $workspace);
    
    // Récupérer les détails des notes
    $results = [];
    foreach ($similarNotes as $item) {
        $stmt = $con->prepare("
            SELECT id, heading, entry, folder, workspace, updated 
            FROM entries 
            WHERE id = ? AND trash = 0
        ");
        $stmt->execute([$item['note_id']]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($note) {
            $results[] = [
                'id' => $note['id'],
                'heading' => $note['heading'],
                'folder' => $note['folder'],
                'workspace' => $note['workspace'],
                'similarity' => round($item['similarity'], 3),
                'preview' => mb_substr(strip_tags($note['entry']), 0, 150) . '...'
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'results' => $results,
        'count' => count($results)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
```

---

## 6. Interface JavaScript (`src/js/ai-assistant.js`)

```javascript
/**
 * Assistant IA pour Poznote
 */

(function() {
    'use strict';
    
    const AIAssistant = {
        /**
         * Générer du contenu avec IA
         */
        async generate(action, content, style = 'professional') {
            try {
                const response = await fetch('api/api_ai_generate.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        action: action,
                        content: content,
                        style: style
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'AI generation failed');
                }
                
                return data.result;
            } catch (error) {
                console.error('AI generation error:', error);
                throw error;
            }
        },
        
        /**
         * Recherche sémantique
         */
        async semanticSearch(query, workspace, limit = 10) {
            try {
                const response = await fetch('api/api_ai_search.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        query: query,
                        workspace: workspace,
                        limit: limit
                    })
                });
                
                const data = await response.json();
                
                if (!data.success) {
                    throw new Error(data.message || 'Semantic search failed');
                }
                
                return data.results;
            } catch (error) {
                console.error('Semantic search error:', error);
                throw error;
            }
        },
        
        /**
         * Insérer du texte généré dans l'éditeur
         */
        insertText(text, noteElement) {
            if (!noteElement) {
                noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            }
            
            if (!noteElement) {
                throw new Error('No editable note found');
            }
            
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                noteElement.textContent += '\n\n' + text;
            }
            
            // Déclencher l'auto-save
            if (typeof updateident === 'function') {
                updateident(noteElement);
            }
        }
    };
    
    // Exposer globalement
    window.AIAssistant = AIAssistant;
    
    // Ajouter les commandes slash pour l'IA
    if (typeof window.SlashCommandMenu !== 'undefined') {
        // Extension du système de slash commands existant
        window.SlashCommandMenu.addCommand('ai-summarize', {
            label: 'Résumer avec IA',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText;
                if (!content.trim()) {
                    alert('Sélectionnez du texte à résumer');
                    return;
                }
                
                try {
                    const summary = await AIAssistant.generate('summarize', content);
                    AIAssistant.insertText(summary, editor);
                } catch (error) {
                    alert('Erreur: ' + error.message);
                }
            }
        });
        
        window.SlashCommandMenu.addCommand('ai-expand', {
            label: 'Développer avec IA',
            action: async (editor) => {
                const content = editor.textContent || editor.innerText;
                if (!content.trim()) {
                    alert('Sélectionnez du texte à développer');
                    return;
                }
                
                try {
                    const expanded = await AIAssistant.generate('expand', content);
                    AIAssistant.insertText(expanded, editor);
                } catch (error) {
                    alert('Erreur: ' + error.message);
                }
            }
        });
    }
})();
```

---

## 7. Migration Base de Données

```sql
-- Ajouter les tables pour l'IA
CREATE TABLE IF NOT EXISTS note_embeddings (
    note_id INTEGER PRIMARY KEY,
    embedding TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON note_embeddings(updated_at);

-- Ajouter les paramètres IA dans la table settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('ai_enabled', '0'),
    ('ai_feature_semantic_search', '0'),
    ('ai_feature_generation', '0'),
    ('ai_feature_tagging', '0');
```

---

## 8. Configuration Docker

Ajouter dans `docker-compose.yml` :

```yaml
services:
  webserver:
    environment:
      # ... autres variables ...
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      AI_ENABLED: ${AI_ENABLED:-0}
```

Et dans `.env` :

```
OPENAI_API_KEY=votre_cle_api_ici
AI_ENABLED=1
```

---

## 🚀 Utilisation

### Dans le code PHP

```php
// Générer un résumé
$summary = AIGenerator::summarize($noteContent);

// Recherche sémantique
$embeddings = new AIEmbeddings($con);
$queryEmbedding = $embeddings->generateEmbedding(0, 'ma requête', '');
$similarNotes = $embeddings->findSimilarNotes($queryEmbedding, 10);
```

### Dans le JavaScript

```javascript
// Résumer du texte sélectionné
const summary = await AIAssistant.generate('summarize', selectedText);
AIAssistant.insertText(summary);

// Recherche sémantique
const results = await AIAssistant.semanticSearch('mon sujet', 'Poznote');
```

---

## 📝 Notes Importantes

1. **Sécurité** : Ne jamais exposer les clés API côté client
2. **Rate Limiting** : Implémenter une limitation des requêtes
3. **Cache** : Mettre en cache les embeddings pour éviter les appels répétés
4. **Erreurs** : Gérer gracieusement les erreurs API
5. **Privacy** : Donner le choix aux utilisateurs d'activer/désactiver l'IA

---

**Ces exemples fournissent une base solide pour intégrer l'IA dans Poznote !**

