<?php
/**
 * API pour extraire des informations structurées
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../ai/ai_generator.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';
require_once __DIR__ . '/../functions.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled() || !AIConfig::isFeatureEnabled('extraction')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Information extraction is disabled']);
    exit;
}

// Vérifier le rate limiting
if (!AIConfig::checkRateLimit()) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Rate limit exceeded']);
    exit;
}

// Seulement POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$content = $input['content'] ?? '';
$noteId = isset($input['note_id']) ? intval($input['note_id']) : null;
$mode = $input['mode'] ?? 'full'; // full|todos

// Si note_id est fourni, récupérer le contenu depuis la base
if ($noteId && empty($content)) {
    try {
        $stmt = $con->prepare("SELECT entry, type FROM entries WHERE id = ?");
        $stmt->execute([$noteId]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($note) {
            $filename = getEntryFilename($noteId, $note['type'] ?? 'note');
            if (file_exists($filename)) {
                $content = file_get_contents($filename);
            } else {
                $content = $note['entry'];
            }
        }
    } catch (Exception $e) {
        // Continuer avec le contenu fourni
    }
}

if (empty($content)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Content or note_id is required']);
    exit;
}

try {
    $generator = new AIGenerator();
    if ($mode === 'todos') {
        $todos = $generator->extractTodos($content);
        AIConfig::recordRequest();
        echo json_encode([
            'success' => true,
            'todos' => $todos,
            'note_id' => $noteId
        ]);
    } else {
        $extracted = $generator->extractInformation($content);
        AIConfig::recordRequest();
        echo json_encode([
            'success' => true,
            'extracted' => $extracted,
            'note_id' => $noteId
        ]);
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

