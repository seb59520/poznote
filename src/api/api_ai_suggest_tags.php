<?php
/**
 * API pour suggérer des tags automatiquement
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../functions.php';
require_once __DIR__ . '/../ai/ai_generator.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled() || !AIConfig::isFeatureEnabled('tagging')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'AI tagging is disabled']);
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

$title = trim($input['title'] ?? '');
$content = $input['content'] ?? '';
$noteId = isset($input['note_id']) ? intval($input['note_id']) : null;

// Si note_id est fourni, récupérer le titre et le contenu depuis la base
if ($noteId && (empty($title) || empty($content))) {
    try {
        $stmt = $con->prepare("SELECT heading, entry FROM entries WHERE id = ?");
        $stmt->execute([$noteId]);
        $note = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($note) {
            if (empty($title)) {
                $title = $note['heading'];
            }
            if (empty($content)) {
                // Lire le fichier de contenu
                $filename = getEntryFilename($noteId, 'note');
                if (file_exists($filename)) {
                    $content = file_get_contents($filename);
                } else {
                    $content = $note['entry'];
                }
            }
        }
    } catch (Exception $e) {
        // Continuer avec les valeurs fournies
    }
}

if (empty($title) && empty($content)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Title or content is required']);
    exit;
}

try {
    $generator = new AIGenerator();
    $tags = $generator->suggestTags($title, $content);
    
    // Enregistrer la requête pour le rate limiting
    AIConfig::recordRequest();
    
    echo json_encode([
        'success' => true,
        'tags' => $tags,
        'tags_string' => implode(', ', $tags)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

