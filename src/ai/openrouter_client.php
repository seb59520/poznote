<?php
/**
 * Client OpenRouter pour les appels API
 */

require_once __DIR__ . '/ai_config.php';

class OpenRouterClient {
    private $apiKey;
    private $baseUrl;
    
    public function __construct() {
        $this->apiKey = AIConfig::getApiKey();
        $this->baseUrl = AIConfig::OPENROUTER_API_URL;
        
        if (!$this->apiKey) {
            throw new Exception('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
        }
    }
    
    /**
     * Appel générique à l'API OpenRouter
     */
    private function callAPI($endpoint, $data) {
        $url = $this->baseUrl . '/' . $endpoint;
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
                'HTTP-Referer: https://poznote.app', // Optionnel mais recommandé
                'X-Title: Poznote AI' // Optionnel
            ],
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_TIMEOUT => AIConfig::TIMEOUT_SECONDS,
            CURLOPT_CONNECTTIMEOUT => 10
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            throw new Exception('CURL error: ' . $error);
        }
        
        if ($httpCode !== 200) {
            $errorData = json_decode($response, true);
            $errorMessage = $errorData['error']['message'] ?? 'Unknown error';
            throw new Exception('OpenRouter API error (' . $httpCode . '): ' . $errorMessage);
        }
        
        return json_decode($response, true);
    }
    
    /**
     * Générer des embeddings
     */
    public function generateEmbedding($text) {
        // OpenRouter utilise le même format qu'OpenAI pour les embeddings
        $data = [
            'model' => AIConfig::MODEL_EMBEDDINGS,
            'input' => mb_substr($text, 0, 8000) // Limiter la longueur
        ];
        
        $response = $this->callAPI('embeddings', $data);
        
        if (!isset($response['data'][0]['embedding'])) {
            throw new Exception('Invalid embedding response');
        }
        
        return $response['data'][0]['embedding'];
    }
    
    /**
     * Générer du texte avec un modèle de chat
     */
    public function generateText($messages, $model = null, $options = []) {
        $model = $model ?? AIConfig::MODEL_GENERATION;
        
        $data = [
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => $options['max_tokens'] ?? AIConfig::MAX_TOKENS,
            'temperature' => $options['temperature'] ?? AIConfig::TEMPERATURE
        ];
        
        // Ajouter des options supplémentaires si fournies
        if (isset($options['stream'])) {
            $data['stream'] = $options['stream'];
        }
        
        $response = $this->callAPI('chat/completions', $data);
        
        if (!isset($response['choices'][0]['message']['content'])) {
            throw new Exception('Invalid chat completion response');
        }
        
        return $response['choices'][0]['message']['content'];
    }
    
    /**
     * Générer du texte avec un prompt simple
     */
    public function generateFromPrompt($prompt, $model = null, $options = []) {
        $messages = [
            [
                'role' => 'system',
                'content' => $options['system_prompt'] ?? 'You are a helpful AI assistant.'
            ],
            [
                'role' => 'user',
                'content' => $prompt
            ]
        ];
        
        return $this->generateText($messages, $model, $options);
    }
}

