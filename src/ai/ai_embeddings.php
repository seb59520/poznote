<?php
/**
 * Gestion des embeddings vectoriels pour la recherche sémantique
 */

require_once __DIR__ . '/openrouter_client.php';

class AIEmbeddings {
    private $con;
    private $client;
    
    public function __construct($databaseConnection) {
        $this->con = $databaseConnection;
        $this->client = new OpenRouterClient();
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
        
        $this->con->exec("
            CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON note_embeddings(updated_at)
        ");
    }
    
    /**
     * Générer un embedding pour une note
     */
    public function generateEmbedding($noteId, $title, $content) {
        // Nettoyer et préparer le texte
        $text = $title . "\n\n" . strip_tags($content);
        $text = preg_replace('/\s+/', ' ', $text); // Normaliser les espaces
        $text = trim($text);
        
        if (empty($text)) {
            return null;
        }
        
        try {
            $embedding = $this->client->generateEmbedding($text);
            return $embedding;
        } catch (Exception $e) {
            error_log('Embedding generation error: ' . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Sauvegarder un embedding dans la base de données
     */
    public function saveEmbedding($noteId, $embedding) {
        $embeddingJson = json_encode($embedding);
        $model = AIConfig::MODEL_EMBEDDINGS;
        
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
    public function findSimilarNotes($queryEmbedding, $limit = 10, $workspace = null, $minSimilarity = 0.3) {
        // Récupérer tous les embeddings
        $query = "
            SELECT ne.note_id, ne.embedding, e.workspace, e.trash
            FROM note_embeddings ne
            INNER JOIN entries e ON ne.note_id = e.id
            WHERE e.trash = 0
        ";
        $params = [];
        
        if ($workspace) {
            $query .= " AND e.workspace = ?";
            $params[] = $workspace;
        }
        
        $stmt = $this->con->prepare($query);
        $stmt->execute($params);
        
        $similarities = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $embedding = json_decode($row['embedding'], true);
            if (!$embedding) {
                continue;
            }
            
            $similarity = $this->cosineSimilarity($queryEmbedding, $embedding);
            
            if ($similarity >= $minSimilarity) {
                $similarities[] = [
                    'note_id' => $row['note_id'],
                    'similarity' => $similarity
                ];
            }
        }
        
        // Trier par similarité décroissante
        usort($similarities, function($a, $b) {
            return $b['similarity'] <=> $a['similarity'];
        });
        
        return array_slice($similarities, 0, $limit);
    }
    
    /**
     * Générer et sauvegarder l'embedding d'une note
     */
    public function processNote($noteId, $title, $content) {
        try {
            $embedding = $this->generateEmbedding($noteId, $title, $content);
            if ($embedding) {
                $this->saveEmbedding($noteId, $embedding);
                return true;
            }
            return false;
        } catch (Exception $e) {
            error_log('Error processing note embedding: ' . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Générer les embeddings pour toutes les notes (batch processing)
     */
    public function processAllNotes($workspace = null, $limit = null) {
        $query = "
            SELECT id, heading, entry 
            FROM entries 
            WHERE trash = 0
        ";
        $params = [];
        
        if ($workspace) {
            $query .= " AND workspace = ?";
            $params[] = $workspace;
        }
        
        $query .= " ORDER BY updated DESC";
        
        if ($limit) {
            $query .= " LIMIT ?";
            $params[] = $limit;
        }
        
        $stmt = $this->con->prepare($query);
        $stmt->execute($params);
        
        $processed = 0;
        $errors = 0;
        
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if ($this->processNote($row['id'], $row['heading'], $row['entry'])) {
                $processed++;
            } else {
                $errors++;
            }
            
            // Petite pause pour éviter de surcharger l'API
            usleep(100000); // 0.1 seconde
        }
        
        return [
            'processed' => $processed,
            'errors' => $errors
        ];
    }
}

