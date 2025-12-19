<?php
/**
 * Script de test pour vérifier l'intégration IA
 * Usage: php test_ai_integration.php
 */

require_once __DIR__ . '/src/config.php';
require_once __DIR__ . '/src/db_connect.php';
require_once __DIR__ . '/src/ai/ai_config.php';

echo "=== Test d'intégration IA ===\n\n";

// Test 1: Vérifier la configuration
echo "1. Test de configuration...\n";
$apiKey = AIConfig::getApiKey();
if ($apiKey) {
    echo "   ✅ Clé API trouvée (longueur: " . strlen($apiKey) . ")\n";
} else {
    echo "   ❌ Clé API non trouvée. Définir OPENROUTER_API_KEY dans .env\n";
    exit(1);
}

// Test 2: Vérifier les tables
echo "\n2. Test des tables de base de données...\n";
try {
    $tables = ['note_embeddings', 'ai_rate_limits', 'note_extracted_info'];
    foreach ($tables as $table) {
        $exists = $con->query("
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='$table'
        ")->fetchColumn();
        
        if ($exists) {
            echo "   ✅ Table '$table' existe\n";
        } else {
            echo "   ❌ Table '$table' n'existe pas\n";
        }
    }
} catch (Exception $e) {
    echo "   ❌ Erreur: " . $e->getMessage() . "\n";
}

// Test 3: Vérifier les paramètres
echo "\n3. Test des paramètres...\n";
try {
    $stmt = $con->prepare("SELECT key, value FROM settings WHERE key LIKE 'ai%'");
    $stmt->execute();
    $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($settings) > 0) {
        echo "   ✅ Paramètres IA trouvés:\n";
        foreach ($settings as $setting) {
            echo "      - {$setting['key']}: {$setting['value']}\n";
        }
    } else {
        echo "   ⚠️  Aucun paramètre IA trouvé (seront créés automatiquement)\n";
    }
} catch (Exception $e) {
    echo "   ❌ Erreur: " . $e->getMessage() . "\n";
}

// Test 4: Vérifier les classes
echo "\n4. Test des classes...\n";
$classes = [
    'AIConfig',
    'OpenRouterClient',
    'AIEmbeddings',
    'AIGenerator'
];

foreach ($classes as $class) {
    if (class_exists($class)) {
        echo "   ✅ Classe '$class' chargée\n";
    } else {
        echo "   ❌ Classe '$class' non trouvée\n";
    }
}

// Test 5: Test de connexion OpenRouter (optionnel)
echo "\n5. Test de connexion OpenRouter...\n";
try {
    require_once __DIR__ . '/src/ai/openrouter_client.php';
    $client = new OpenRouterClient();
    echo "   ✅ Client OpenRouter initialisé\n";
    
    // Test simple d'embedding (coûteux, commenté par défaut)
    // echo "   Test d'embedding...\n";
    // $embedding = $client->generateEmbedding("Test");
    // echo "   ✅ Embedding généré (dimension: " . count($embedding) . ")\n";
    
} catch (Exception $e) {
    echo "   ❌ Erreur: " . $e->getMessage() . "\n";
}

// Test 6: Vérifier les fichiers API
echo "\n6. Test des fichiers API...\n";
$apiFiles = [
    'api_ai_generate.php',
    'api_ai_search.php',
    'api_ai_suggest_tags.php',
    'api_ai_related_notes.php',
    'api_ai_extract.php',
    'api_ai_process_embeddings.php'
];

foreach ($apiFiles as $file) {
    $path = __DIR__ . '/src/api/' . $file;
    if (file_exists($path)) {
        echo "   ✅ $file existe\n";
    } else {
        echo "   ❌ $file manquant\n";
    }
}

// Test 7: Vérifier les fichiers JavaScript
echo "\n7. Test des fichiers JavaScript...\n";
$jsFiles = [
    'ai-assistant.js',
    'ai-integration.js'
];

foreach ($jsFiles as $file) {
    $path = __DIR__ . '/src/js/' . $file;
    if (file_exists($path)) {
        echo "   ✅ $file existe\n";
    } else {
        echo "   ❌ $file manquant\n";
    }
}

echo "\n=== Tests terminés ===\n";
echo "\nPour activer les fonctionnalités IA:\n";
echo "1. Définir OPENROUTER_API_KEY dans .env\n";
echo "2. Activer les fonctionnalités dans Settings ou via SQL:\n";
echo "   UPDATE settings SET value = '1' WHERE key = 'ai_enabled';\n";
echo "3. Générer les embeddings: POST /api/api_ai_process_embeddings.php\n";

?>

