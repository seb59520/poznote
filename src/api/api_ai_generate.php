<?php
/**
 * API pour la génération de contenu avec IA
 * Actions: summarize, expand, rewrite, improve
 */

require __DIR__ . '/../auth.php';
requireApiAuth();

header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../ai/ai_generator.php';
require_once __DIR__ . '/../ai/ai_config.php';
require_once __DIR__ . '/../db_connect.php';

// Vérifier que l'IA est activée
if (!AIConfig::isEnabled()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'AI features are disabled']);
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

$action = $input['action'] ?? '';
$content = $input['content'] ?? '';
$style = $input['style'] ?? 'professional';
$maxLength = isset($input['max_length']) ? intval($input['max_length']) : 3;

try {
    $generator = new AIGenerator();
    $result = '';
    
    switch ($action) {
        case 'summarize':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            if (!AIConfig::isFeatureEnabled('generation')) {
                throw new Exception('Generation feature is disabled');
            }
            $result = $generator->summarize($content, $maxLength);
            break;
            
        case 'expand':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            if (!AIConfig::isFeatureEnabled('generation')) {
                throw new Exception('Generation feature is disabled');
            }
            $result = $generator->expand($content, $style);
            break;
            
        case 'rewrite':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            if (!AIConfig::isFeatureEnabled('generation')) {
                throw new Exception('Generation feature is disabled');
            }
            $result = $generator->rewrite($content, $style);
            break;
        
        case 'improve':
            if (empty($content)) {
                throw new Exception('Content is required');
            }
            if (!AIConfig::isFeatureEnabled('generation')) {
                throw new Exception('Generation feature is disabled');
            }
            $result = $generator->improve($content, $style);
            break;
            
        default:
            throw new Exception('Invalid action. Use: summarize, expand, rewrite, or improve');
    }
    
    // Enregistrer la requête pour le rate limiting
    AIConfig::recordRequest();
    
    echo json_encode([
        'success' => true,
        'result' => $result,
        'action' => $action
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}

