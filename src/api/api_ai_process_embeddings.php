<?php
/**
 * API pour générer les embeddings d'une note ou de toutes les notes
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

$action = $input['action'] ?? 'single';
$noteId = isset($input['note_id']) ? intval($input['note_id']) : null;
$workspace = $input['workspace'] ?? null;
$limit = isset($input['limit']) ? intval($input['limit']) : 100;

try {
    $embeddings = new AIEmbeddings($con);
    
    if ($action === 'single' && $noteId) {
        // Traiter une seule note
        $stmt = $con->prepare("SELECT id, heading, entry, type FROM entries WHERE id = ?");
        $stmt->execute([$noteId]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$note) {
            throw new Exception('Note not found');
        }
        
        // Lire le contenu depuis le fichier
        $filename = getEntryFilename($noteId, $note['type'] ?? 'note');
        $content = file_exists($filename) ? file_get_contents($filename) : $note['entry'];
        
        $success = $embeddings->processNote($noteId, $note['heading'], $content);
        
        echo json_encode([
            'success' => $success,
            'note_id' => $noteId,
            'message' => $success ? 'Embedding generated successfully' : 'Failed to generate embedding'
        ]);
        
    } elseif ($action === 'batch') {
        // Traiter plusieurs notes
        $result = $embeddings->processAllNotes($workspace, $limit);
        
        echo json_encode([
            'success' => true,
            'processed' => $result['processed'],
            'errors' => $result['errors'],
            'workspace' => $workspace,
            'limit' => $limit
        ]);
        
    } else {
        throw new Exception('Invalid action. Use: single (with note_id) or batch');
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

