<?php
/**
 * Génération de contenu avec IA via OpenRouter
 */

require_once __DIR__ . '/openrouter_client.php';

class AIGenerator {
    private $client;
    
    public function __construct() {
        $this->client = new OpenRouterClient();
    }
    
    /**
     * Résumer une note
     */
    public function summarize($content, $maxLength = 3) {
        $text = strip_tags($content);
        $text = mb_substr($text, 0, 4000); // Limiter la longueur
        
        $prompt = "Résume le texte suivant en {$maxLength} phrases concises. Concentre-toi sur les points principaux:\n\n" . $text;
        
        $systemPrompt = "Tu es un assistant qui crée des résumés clairs et concis. Réponds uniquement avec le résumé, sans introduction ni conclusion.";
        
        try {
            return $this->client->generateFromPrompt($prompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 200,
                'temperature' => 0.3
            ]);
        } catch (Exception $e) {
            throw new Exception('Erreur lors de la génération du résumé: ' . $e->getMessage());
        }
    }
    
    /**
     * Développer un texte
     */
    public function expand($text, $style = 'detailed') {
        $text = strip_tags($text);
        $text = mb_substr($text, 0, 2000);
        
        $styleInstructions = [
            'detailed' => 'Développe et enrichis le texte suivant avec plus de détails, d\'exemples et d\'explications:',
            'professional' => 'Développe le texte suivant dans un style professionnel avec des détails pertinents:',
            'academic' => 'Développe le texte suivant dans un style académique avec des arguments structurés:',
            'casual' => 'Développe le texte suivant de manière décontractée et accessible:'
        ];
        
        $instruction = $styleInstructions[$style] ?? $styleInstructions['detailed'];
        $prompt = $instruction . "\n\n" . $text;
        
        $systemPrompt = "Tu es un assistant d'écriture qui développe et enrichit des textes. Réponds uniquement avec le texte développé.";
        
        try {
            return $this->client->generateFromPrompt($prompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 800,
                'temperature' => 0.7
            ]);
        } catch (Exception $e) {
            throw new Exception('Erreur lors du développement du texte: ' . $e->getMessage());
        }
    }
    
    /**
     * Réécrire un texte
     */
    public function rewrite($text, $style = 'professional') {
        $text = strip_tags($text);
        $text = mb_substr($text, 0, 3000);
        
        $styleInstructions = [
            'professional' => 'Réécris ce texte dans un style professionnel, clair et structuré:',
            'casual' => 'Réécris ce texte dans un style décontracté et accessible:',
            'concise' => 'Réécris ce texte de manière plus concise en gardant les informations essentielles:',
            'detailed' => 'Réécris ce texte avec plus de détails et d\'explications:',
            'formal' => 'Réécris ce texte dans un style formel et académique:',
            'simple' => 'Réécris ce texte de manière simple et facile à comprendre:'
        ];
        
        $instruction = $styleInstructions[$style] ?? $styleInstructions['professional'];
        $prompt = $instruction . "\n\n" . $text;
        
        $systemPrompt = "Tu es un assistant qui réécrit des textes dans différents styles. Réponds uniquement avec le texte réécrit.";
        
        try {
            return $this->client->generateFromPrompt($prompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 1000,
                'temperature' => 0.7
            ]);
        } catch (Exception $e) {
            throw new Exception('Erreur lors de la réécriture: ' . $e->getMessage());
        }
    }
    
    /**
     * Améliorer style et grammaire
     */
    public function improve($text, $tone = 'neutral') {
        $text = strip_tags($text);
        $text = mb_substr($text, 0, 3000);
        
        $toneInstructions = [
            'neutral' => 'Améliore la clarté, la grammaire et la fluidité sans changer le sens.',
            'concise' => 'Rends le texte plus concis et direct, sans perdre d\'informations importantes.',
            'formal' => 'Adopte un ton formel et professionnel, corrige la grammaire et la structure.',
            'friendly' => 'Adopte un ton amical et accessible, corrige la grammaire et simplifie les phrases.',
            'technical' => 'Garde un ton technique précis, clarifie et structure le texte.',
        ];
        
        $instruction = $toneInstructions[$tone] ?? $toneInstructions['neutral'];
        $prompt = $instruction . "\n\nTexte:\n" . $text . "\n\nRéponds uniquement avec le texte amélioré.";
        
        $systemPrompt = "Tu es un assistant qui améliore style et grammaire. Ne change pas le sens. Réponds uniquement avec le texte corrigé.";
        
        try {
            return $this->client->generateFromPrompt($prompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 1000,
                'temperature' => 0.4
            ]);
        } catch (Exception $e) {
            throw new Exception('Erreur lors de l\'amélioration: ' . $e->getMessage());
        }
    }
    
    /**
     * Suggérer des tags basés sur le contenu
     */
    public function suggestTags($title, $content) {
        $text = $title . "\n\n" . strip_tags($content);
        $text = mb_substr($text, 0, 3000);
        
        $prompt = "Analyse ce texte et extrais 3 à 5 mots-clés (tags) pertinents qui décrivent le sujet principal. Les tags doivent être:\n";
        $prompt .= "- Des mots simples (pas de phrases)\n";
        $prompt .= "- En français si le texte est en français\n";
        $prompt .= "- Séparés par des virgules\n";
        $prompt .= "- Pertinents et spécifiques\n\n";
        $prompt .= "Texte:\n" . $text . "\n\n";
        $prompt .= "Réponds UNIQUEMENT avec les tags séparés par des virgules, sans explication.";
        
        $systemPrompt = "Tu es un assistant qui extrait des mots-clés pertinents. Réponds uniquement avec les tags séparés par des virgules.";
        
        try {
            $response = $this->client->generateFromPrompt($prompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 100,
                'temperature' => 0.3
            ]);
            
            // Nettoyer et formater les tags
            $tags = array_map('trim', explode(',', $response));
            $tags = array_filter($tags, function($tag) {
                $tag = trim($tag);
                return !empty($tag) && 
                       strlen($tag) < 50 && 
                       strlen($tag) > 1 &&
                       !preg_match('/[\.\!\?]/', $tag); // Pas de ponctuation
            });
            
            // Limiter à 5 tags
            return array_slice($tags, 0, 5);
        } catch (Exception $e) {
            throw new Exception('Erreur lors de la suggestion de tags: ' . $e->getMessage());
        }
    }
    
    /**
     * Suggérer un dossier approprié
     */
    public function suggestFolder($title, $content, $availableFolders) {
        $text = $title . "\n\n" . strip_tags($content);
        $text = mb_substr($text, 0, 2000);
        
        $foldersList = implode(', ', $availableFolders);
        
        $prompt = "Analyse ce texte et suggère le dossier le plus approprié parmi cette liste:\n";
        $prompt .= $foldersList . "\n\n";
        $prompt .= "Texte:\n" . $text . "\n\n";
        $prompt .= "Réponds UNIQUEMENT avec le nom exact du dossier, sans explication.";
        
        $systemPrompt = "Tu es un assistant qui classe des documents dans des dossiers. Réponds uniquement avec le nom du dossier.";
        
        try {
            $response = trim($this->client->generateFromPrompt($prompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 50,
                'temperature' => 0.2
            ]));
            
            // Vérifier que le dossier suggéré existe dans la liste
            foreach ($availableFolders as $folder) {
                if (stripos($folder, $response) !== false || stripos($response, $folder) !== false) {
                    return $folder;
                }
            }
            
            return null; // Aucun dossier approprié trouvé
        } catch (Exception $e) {
            throw new Exception('Erreur lors de la suggestion de dossier: ' . $e->getMessage());
        }
    }
    
    /**
     * Créer une note structurée à partir d'un prompt
     */
    public function createNoteFromPrompt($prompt, $type = 'structured') {
        $systemPrompts = [
            'structured' => 'Tu es un assistant qui crée des notes structurées et organisées. Génère du contenu HTML bien formaté avec des sections, listes, et éléments visuels.',
            'meeting' => 'Tu es un assistant qui crée des comptes-rendus de réunion structurés. Inclus : ordre du jour, participants, points discutés, décisions, actions.',
            'project' => 'Tu es un assistant qui crée des plans de projet détaillés. Inclus : objectifs, étapes, délais, ressources, risques.',
            'checklist' => 'Tu es un assistant qui crée des listes de tâches structurées. Génère une checklist complète et organisée.',
            'summary' => 'Tu es un assistant qui crée des résumés structurés. Organise l\'information de manière claire et hiérarchique.',
            'brainstorm' => 'Tu es un assistant créatif qui génère des idées structurées. Organise les idées par catégories et priorités.'
        ];
        
        $systemPrompt = $systemPrompts[$type] ?? $systemPrompts['structured'];
        
        $userPrompt = "Crée une note complète et structurée sur le sujet suivant. ";
        $userPrompt .= "La note doit être bien organisée avec des sections, des listes à puces, et éventuellement des checklists. ";
        $userPrompt .= "Utilise du HTML pour le formatage (titres h2, h3, listes ul/ol, paragraphes). ";
        $userPrompt .= "Rends le contenu pratique et actionnable.\n\n";
        $userPrompt .= "Sujet: " . $prompt;
        
        try {
            $content = $this->client->generateFromPrompt($userPrompt, null, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 2000,
                'temperature' => 0.7
            ]);
            
            // Nettoyer et formater le contenu HTML
            $content = $this->cleanGeneratedHTML($content);
            
            return $content;
        } catch (Exception $e) {
            throw new Exception('Erreur lors de la génération de la note: ' . $e->getMessage());
        }
    }
    
    /**
     * Nettoyer et formater le HTML généré
     */
    private function cleanGeneratedHTML($html) {
        // Si le contenu contient du markdown, le convertir en HTML
        if (preg_match('/^#+\s/m', $html)) {
            // Convertir les titres markdown
            $html = preg_replace('/^###\s+(.+)$/m', '<h3>$1</h3>', $html);
            $html = preg_replace('/^##\s+(.+)$/m', '<h2>$1</h2>', $html);
            $html = preg_replace('/^#\s+(.+)$/m', '<h1>$1</h1>', $html);
            
            // Convertir les listes markdown
            $html = preg_replace('/^-\s+(.+)$/m', '<li>$1</li>', $html);
            $html = preg_replace('/^\*\s+(.+)$/m', '<li>$1</li>', $html);
            
            // Envelopper les listes
            $html = preg_replace('/(<li>.*<\/li>\n?)+/s', '<ul>$0</ul>', $html);
        }
        
        // S'assurer que le HTML est valide
        $html = trim($html);
        
        // Ajouter des paragraphes si nécessaire
        $lines = explode("\n", $html);
        $formatted = [];
        $inList = false;
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) {
                if ($inList) {
                    $inList = false;
                }
                continue;
            }
            
            if (preg_match('/^<[ou]l>/', $line) || preg_match('/^<li>/', $line)) {
                $inList = true;
                $formatted[] = $line;
            } elseif (preg_match('/^<\/[ou]l>/', $line)) {
                $inList = false;
                $formatted[] = $line;
            } elseif (preg_match('/^<h[1-6]>/', $line)) {
                $formatted[] = $line;
            } elseif (!$inList && !preg_match('/^</', $line)) {
                $formatted[] = '<p>' . htmlspecialchars($line) . '</p>';
            } else {
                $formatted[] = $line;
            }
        }
        
        return implode("\n", $formatted);
    }
    
    /**
     * Extraire des informations structurées
     */
    public function extractInformation($content) {
        $text = strip_tags($content);
        $text = mb_substr($text, 0, 4000);
        
        $prompt = "Extrais les informations suivantes de ce texte et réponds au format JSON:\n";
        $prompt .= "{\n";
        $prompt .= "  \"dates\": [\"liste des dates importantes\"],\n";
        $prompt .= "  \"tasks\": [\"liste des tâches/TODO mentionnés\"],\n";
        $prompt .= "  \"people\": [\"liste des personnes mentionnées\"],\n";
        $prompt .= "  \"topics\": [\"liste des sujets principaux\"],\n";
        $prompt .= "  \"keywords\": [\"mots-clés importants\"]\n";
        $prompt .= "}\n\n";
        $prompt .= "Texte:\n" . $text;
        
        $systemPrompt = "Tu es un assistant qui extrait des informations structurées. Réponds uniquement avec du JSON valide.";
        
        try {
            $response = $this->client->generateFromPrompt($prompt, AIConfig::MODEL_EXTRACTION, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 500,
                'temperature' => 0.2
            ]);
            
            // Nettoyer la réponse (enlever markdown si présent)
            $response = preg_replace('/```json\s*/', '', $response);
            $response = preg_replace('/```\s*/', '', $response);
            $response = trim($response);
            
            $data = json_decode($response, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Invalid JSON response: ' . json_last_error_msg());
            }
            
            return $data;
        } catch (Exception $e) {
            throw new Exception('Erreur lors de l\'extraction: ' . $e->getMessage());
        }
    }
    
    /**
     * Extraire uniquement les TODO / actions
     */
    public function extractTodos($content) {
        $text = strip_tags($content);
        $text = mb_substr($text, 0, 4000);
        
        $prompt = "Extrait les tâches (TODO) du texte suivant et réponds en JSON strict:\n";
        $prompt .= "[\n  {\n    \"title\": \"Intitulé de la tâche\",\n    \"due_date\": \"YYYY-MM-DD\" | null,\n    \"assignee\": \"Personne responsable\" | null,\n    \"priority\": \"low|medium|high\" | null,\n    \"status\": \"todo|in_progress|done\" | null\n  }\n]\n";
        $prompt .= "Inclure au moins le champ \"title\". Utilise null quand l'information n'est pas présente.\n\n";
        $prompt .= "Texte:\n" . $text;
        
        $systemPrompt = "Tu es un assistant qui extrait des tâches actionnables. Réponds uniquement avec un JSON valide (tableau d'objets).";
        
        try {
            $response = $this->client->generateFromPrompt($prompt, AIConfig::MODEL_EXTRACTION, [
                'system_prompt' => $systemPrompt,
                'max_tokens' => 400,
                'temperature' => 0.2
            ]);
            
            // Nettoyer la réponse (enlever markdown si présent)
            $response = preg_replace('/```json\s*/', '', $response);
            $response = preg_replace('/```\s*/', '', $response);
            $response = trim($response);
            
            $data = json_decode($response, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Invalid JSON response: ' . json_last_error_msg());
            }
            
            // Normaliser les champs
            $todos = [];
            foreach ($data as $item) {
                if (!isset($item['title']) || trim($item['title']) === '') {
                    continue;
                }
                $todos[] = [
                    'title' => trim($item['title']),
                    'due_date' => $item['due_date'] ?? null,
                    'assignee' => $item['assignee'] ?? null,
                    'priority' => $item['priority'] ?? null,
                    'status' => $item['status'] ?? null,
                ];
            }
            
            return $todos;
        } catch (Exception $e) {
            throw new Exception('Erreur lors de l\'extraction des TODO: ' . $e->getMessage());
        }
    }
}

