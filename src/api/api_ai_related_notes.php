<?php
/**
 * API pour trouver des notes liées/similaires
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../ai/ai_embeddings.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../functions.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled() || !AIConfig::isFeatureEnabled('related_notes')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Related notes feature is disabled']);
    exit;
}

// Vérifier le rate limiting
if (!AIConfig::checkRateLimit()) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Rate limit exceeded']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$noteId = isset($input['note_id']) ? intval($input['note_id']) : 0;
$limit = isset($input['limit']) ? intval($input['limit']) : 5;
$minSimilarity = isset($input['min_similarity']) ? floatval($input['min_similarity']) : 0.4;

if (empty($noteId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'note_id is required']);
    exit;
}

try {
    // Récupérer la note
    $stmt = $con->prepare("
        SELECT id, heading, entry, workspace 
        FROM entries 
        WHERE id = ? AND trash = 0
    ");
    $stmt->execute([$noteId]);
    $note = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$note) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Note not found']);
        exit;
    }
    
    // Lire le contenu depuis le fichier si disponible
    $filename = getEntryFilename($noteId, 'note');
    if (file_exists($filename)) {
        $content = file_get_contents($filename);
    } else {
        $content = $note['entry'];
    }
    
    $embeddings = new AIEmbeddings($con);
    
    // Récupérer ou générer l'embedding de la note
    $noteEmbedding = $embeddings->getEmbedding($noteId);
    
    if (!$noteEmbedding) {
        // Générer l'embedding si il n'existe pas
        $noteEmbedding = $embeddings->generateEmbedding($noteId, $note['heading'], $content);
        if ($noteEmbedding) {
            $embeddings->saveEmbedding($noteId, $noteEmbedding);
        }
    }
    
    if (!$noteEmbedding) {
        throw new Exception('Failed to get or generate note embedding');
    }
    
    // Trouver les notes similaires (exclure la note actuelle)
    $similarNotes = $embeddings->findSimilarNotes(
        $noteEmbedding, 
        $limit + 1, // +1 pour exclure la note actuelle
        $note['workspace'],
        $minSimilarity
    );
    
    // Filtrer la note actuelle et préparer les résultats
    $results = [];
    foreach ($similarNotes as $item) {
        if ($item['note_id'] == $noteId) {
            continue; // Exclure la note actuelle
        }
        
        $stmt = $con->prepare("
            SELECT id, heading, folder, tags, updated
            FROM entries 
            WHERE id = ? AND trash = 0
        ");
        $stmt->execute([$item['note_id']]);
        $relatedNote = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($relatedNote) {
            $results[] = [
                'id' => $relatedNote['id'],
                'heading' => $relatedNote['heading'],
                'folder' => $relatedNote['folder'],
                'tags' => $relatedNote['tags'],
                'similarity' => round($item['similarity'], 3),
                'updated' => $relatedNote['updated']
            ];
        }
        
        if (count($results) >= $limit) {
            break;
        }
    }
    
    // Enregistrer la requête pour le rate limiting
    AIConfig::recordRequest();
    
    echo json_encode([
        'success' => true,
        'related_notes' => $results,
        'count' => count($results),
        'note_id' => $noteId
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

