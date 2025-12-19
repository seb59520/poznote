<?php
/**
 * API pour la recherche sémantique avec embeddings
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../ai/ai_embeddings.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled() || !AIConfig::isFeatureEnabled('semantic_search')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Semantic search is disabled']);
    exit;
}

// Vérifier le rate limiting
if (!AIConfig::checkRateLimit()) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Rate limit exceeded']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$query = trim($input['query'] ?? '');
$workspace = $input['workspace'] ?? null;
$limit = isset($input['limit']) ? intval($input['limit']) : 10;
$minSimilarity = isset($input['min_similarity']) ? floatval($input['min_similarity']) : 0.3;

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
    $similarNotes = $embeddings->findSimilarNotes($queryEmbedding, $limit, $workspace, $minSimilarity);
    
    // Récupérer les détails des notes
    $results = [];
    foreach ($similarNotes as $item) {
        $stmt = $con->prepare("
            SELECT id, heading, entry, folder, workspace, updated, tags
            FROM entries 
            WHERE id = ? AND trash = 0
        ");
        $stmt->execute([$item['note_id']]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($note) {
            $preview = strip_tags($note['entry']);
            $preview = mb_substr($preview, 0, 200);
            
            $results[] = [
                'id' => $note['id'],
                'heading' => $note['heading'],
                'folder' => $note['folder'],
                'workspace' => $note['workspace'],
                'tags' => $note['tags'],
                'similarity' => round($item['similarity'], 3),
                'preview' => $preview . (mb_strlen(strip_tags($note['entry'])) > 200 ? '...' : ''),
                'updated' => $note['updated']
            ];
        }
    }
    
    // Enregistrer la requête pour le rate limiting
    AIConfig::recordRequest();
    
    echo json_encode([
        'success' => true,
        'results' => $results,
        'count' => count($results),
        'query' => $query
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

