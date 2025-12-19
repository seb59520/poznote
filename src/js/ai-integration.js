/**
 * Intégration UI pour les fonctionnalités IA
 * Ajoute les boutons et interfaces dans l'éditeur de notes
 */

(function() {
    'use strict';
    
    const AIIntegration = {
        /**
         * Initialiser l'intégration IA
         */
        init() {
            this.addAIButtons();
            this.addRelatedNotesPanel();
            this.addTagSuggestionButton();
            this.addExtractInfoButton();
        },
        
        /**
         * Ajouter les boutons IA dans la toolbar
         */
        addAIButtons() {
            // Attendre que la toolbar soit chargée
            const checkToolbar = setInterval(() => {
                const toolbar = document.querySelector('.note-edit-toolbar');
                if (toolbar && !toolbar.querySelector('.ai-buttons-added')) {
                    this.createAIButtons(toolbar);
                    toolbar.classList.add('ai-buttons-added');
                    clearInterval(checkToolbar);
                }
            }, 500);
        },
        
        /**
         * Créer les boutons IA
         */
        createAIButtons(toolbar) {
            // Bouton résumer
            const summarizeBtn = this.createButton('Résumer', 'fa-compress', () => {
                this.handleSummarize();
            });
            
            // Bouton développer
            const expandBtn = this.createButton('Développer', 'fa-expand', () => {
                this.handleExpand();
            });
            
            // Bouton réécrire
            const rewriteBtn = this.createButton('Réécrire', 'fa-pen', () => {
                this.handleRewrite();
            });
            
            // Séparateur
            const separator = document.createElement('span');
            separator.className = 'toolbar-separator';
            separator.style.cssText = 'width: 1px; height: 24px; background: #ddd; margin: 0 8px;';
            
            // Ajouter les boutons après les boutons de formatage existants
            const formatButtons = toolbar.querySelectorAll('.text-format-btn');
            if (formatButtons.length > 0) {
                const lastFormatBtn = formatButtons[formatButtons.length - 1];
                lastFormatBtn.after(separator, summarizeBtn, expandBtn, rewriteBtn);
            } else {
                toolbar.appendChild(separator);
                toolbar.appendChild(summarizeBtn);
                toolbar.appendChild(expandBtn);
                toolbar.appendChild(rewriteBtn);
            }
        },
        
        /**
         * Créer un bouton
         */
        createButton(title, iconClass, onClick) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toolbar-btn ai-action-btn';
            btn.title = title;
            btn.innerHTML = `<i class="fa ${iconClass}"></i>`;
            btn.onclick = onClick;
            btn.style.cssText = 'margin: 0 2px;';
            return btn;
        },
        
        /**
         * Gérer le résumé
         */
        async handleSummarize() {
            const noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            if (!noteElement) {
                window.AIAssistant.showNotification('Aucune note ouverte', 'warning');
                return;
            }
            
            const selection = window.getSelection();
            let content = '';
            
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                content = selection.toString();
            } else {
                content = noteElement.textContent || noteElement.innerText || '';
            }
            
            if (!content.trim()) {
                window.AIAssistant.showNotification('Sélectionnez du texte à résumer', 'warning');
                return;
            }
            
            const loading = window.AIAssistant.showLoading(noteElement, 'Génération du résumé...');
            try {
                const summary = await window.AIAssistant.generate('summarize', content);
                loading.remove();
                
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    window.AIAssistant.replaceSelectedText(summary);
                } else {
                    window.AIAssistant.insertText('\n\n**Résumé:**\n' + summary, noteElement);
                }
                
                window.AIAssistant.showNotification('Résumé généré avec succès', 'success');
            } catch (error) {
                loading.remove();
                window.AIAssistant.showNotification('Erreur: ' + error.message, 'error');
            }
        },
        
        /**
         * Gérer le développement
         */
        async handleExpand() {
            const noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            if (!noteElement) {
                window.AIAssistant.showNotification('Aucune note ouverte', 'warning');
                return;
            }
            
            const selection = window.getSelection();
            let content = '';
            
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                content = selection.toString();
            } else {
                content = noteElement.textContent || noteElement.innerText || '';
            }
            
            if (!content.trim()) {
                window.AIAssistant.showNotification('Sélectionnez du texte à développer', 'warning');
                return;
            }
            
            const loading = window.AIAssistant.showLoading(noteElement, 'Développement du texte...');
            try {
                const expanded = await window.AIAssistant.generate('expand', content);
                loading.remove();
                
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    window.AIAssistant.replaceSelectedText(expanded);
                } else {
                    window.AIAssistant.insertText('\n\n' + expanded, noteElement);
                }
                
                window.AIAssistant.showNotification('Texte développé avec succès', 'success');
            } catch (error) {
                loading.remove();
                window.AIAssistant.showNotification('Erreur: ' + error.message, 'error');
            }
        },
        
        /**
         * Gérer la réécriture
         */
        async handleRewrite() {
            const noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            if (!noteElement) {
                window.AIAssistant.showNotification('Aucune note ouverte', 'warning');
                return;
            }
            
            const selection = window.getSelection();
            let content = '';
            
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                content = selection.toString();
            } else {
                content = noteElement.textContent || noteElement.innerText || '';
            }
            
            if (!content.trim()) {
                window.AIAssistant.showNotification('Sélectionnez du texte à réécrire', 'warning');
                return;
            }
            
            const style = prompt('Style de réécriture:\n1. professional\n2. casual\n3. concise\n4. detailed\n5. formal\n6. simple', 'professional');
            if (!style) return;
            
            const loading = window.AIAssistant.showLoading(noteElement, 'Réécriture en cours...');
            try {
                const rewritten = await window.AIAssistant.generate('rewrite', content, { style: style });
                loading.remove();
                
                if (selection.rangeCount > 0 && !selection.isCollapsed) {
                    window.AIAssistant.replaceSelectedText(rewritten);
                } else {
                    window.AIAssistant.insertText('\n\n**Version réécrite:**\n' + rewritten, noteElement);
                }
                
                window.AIAssistant.showNotification('Texte réécrit avec succès', 'success');
            } catch (error) {
                loading.remove();
                window.AIAssistant.showNotification('Erreur: ' + error.message, 'error');
            }
        },
        
        /**
         * Ajouter le bouton de suggestion de tags
         */
        addTagSuggestionButton() {
            const checkTags = setInterval(() => {
                const tagsRow = document.querySelector('.note-tags-row');
                if (tagsRow && !tagsRow.querySelector('.ai-suggest-tags-btn')) {
                    const suggestBtn = document.createElement('button');
                    suggestBtn.className = 'ai-suggest-tags-btn';
                    suggestBtn.innerHTML = '<i class="fa fa-magic"></i> Suggérer';
                    suggestBtn.title = 'Suggérer des tags avec IA';
                    suggestBtn.style.cssText = 'margin-left: 8px; padding: 4px 8px; font-size: 12px;';
                    suggestBtn.onclick = () => this.handleSuggestTags();
                    
                    const tagIcon = tagsRow.querySelector('.icon_tag');
                    if (tagIcon) {
                        tagIcon.parentNode.insertBefore(suggestBtn, tagIcon.nextSibling);
                    }
                    
                    clearInterval(checkTags);
                }
            }, 500);
        },
        
        /**
         * Gérer la suggestion de tags
         */
        async handleSuggestTags() {
            const noteId = this.getCurrentNoteId();
            if (!noteId) {
                window.AIAssistant.showNotification('Aucune note ouverte', 'warning');
                return;
            }
            
            const titleInput = document.querySelector('.css-title');
            const noteElement = document.querySelector('.noteentry[contenteditable="true"]');
            
            const title = titleInput ? titleInput.value : '';
            const content = noteElement ? (noteElement.textContent || noteElement.innerText || '') : '';
            
            if (!title && !content) {
                window.AIAssistant.showNotification('La note doit avoir un titre ou du contenu', 'warning');
                return;
            }
            
            try {
                const tags = await window.AIAssistant.suggestTags(noteId, title, content);
                
                if (tags && tags.length > 0) {
                    const tagsInput = document.getElementById('tags' + noteId);
                    if (tagsInput) {
                        const currentTags = tagsInput.value.split(/\s+/).filter(t => t);
                        const allTags = [...new Set([...currentTags, ...tags])];
                        tagsInput.value = allTags.join(' ');
                        
                        // Déclencher la mise à jour des tags
                        if (typeof updateTags === 'function') {
                            updateTags(noteId);
                        }
                    }
                    
                    window.AIAssistant.showNotification('Tags suggérés: ' + tags.join(', '), 'success');
                } else {
                    window.AIAssistant.showNotification('Aucun tag suggéré', 'info');
                }
            } catch (error) {
                window.AIAssistant.showNotification('Erreur: ' + error.message, 'error');
            }
        },
        
        /**
         * Ajouter le panneau de notes liées
         */
        addRelatedNotesPanel() {
            const checkRightCol = setInterval(() => {
                const rightCol = document.getElementById('right_col');
                if (rightCol && !rightCol.querySelector('.ai-related-notes-panel')) {
                    this.createRelatedNotesPanel(rightCol);
                    clearInterval(checkRightCol);
                }
            }, 500);
        },
        
        /**
         * Créer le panneau de notes liées
         */
        createRelatedNotesPanel(container) {
            const panel = document.createElement('div');
            panel.className = 'ai-related-notes-panel';
            panel.id = 'ai-related-notes-panel';
            panel.style.cssText = `
                margin-top: 20px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
                display: none;
            `;
            
            panel.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; font-size: 14px; font-weight: 600;">Notes liées</h4>
                    <button class="ai-refresh-related" style="background: none; border: none; cursor: pointer; font-size: 12px;">
                        <i class="fa fa-refresh"></i>
                    </button>
                </div>
                <div class="ai-related-notes-list"></div>
            `;
            
            container.appendChild(panel);
            
            // Observer les changements de note pour charger les notes liées
            this.observeNoteChanges();
        },
        
        /**
         * Observer les changements de note
         */
        observeNoteChanges() {
            const observer = new MutationObserver(() => {
                const noteId = this.getCurrentNoteId();
                if (noteId) {
                    this.loadRelatedNotes(noteId);
                }
            });
            
            const rightCol = document.getElementById('right_col');
            if (rightCol) {
                observer.observe(rightCol, { childList: true, subtree: true });
            }
        },
        
        /**
         * Charger les notes liées
         */
        async loadRelatedNotes(noteId) {
            const panel = document.getElementById('ai-related-notes-panel');
            if (!panel) return;
            
            const list = panel.querySelector('.ai-related-notes-list');
            if (!list) return;
            
            try {
                const relatedNotes = await window.AIAssistant.findRelatedNotes(noteId);
                
                if (relatedNotes && relatedNotes.length > 0) {
                    panel.style.display = 'block';
                    list.innerHTML = relatedNotes.map(note => `
                        <div class="ai-related-note-item" style="
                            padding: 8px;
                            margin-bottom: 8px;
                            background: white;
                            border-radius: 4px;
                            cursor: pointer;
                            border-left: 3px solid #3498db;
                        " onclick="window.location.href='index.php?note=${note.id}&workspace=${note.workspace || window.selectedWorkspace || 'Poznote'}'">
                            <div style="font-weight: 600; font-size: 13px;">${this.escapeHtml(note.heading)}</div>
                            <div style="font-size: 11px; color: #666; margin-top: 4px;">
                                ${note.folder ? '<span>' + this.escapeHtml(note.folder) + '</span>' : ''}
                                <span style="margin-left: 8px;">Similarité: ${(note.similarity * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    `).join('');
                } else {
                    panel.style.display = 'none';
                }
            } catch (error) {
                // Ne pas afficher d'erreur si c'est juste un rate limit
                if (error.message && error.message.includes('Rate limit')) {
                    // Silencieusement masquer le panel si rate limit
                    panel.style.display = 'none';
                } else {
                    console.error('Error loading related notes:', error);
                    panel.style.display = 'none';
                }
            }
        },
        
        /**
         * Ajouter le bouton d'extraction d'informations
         */
        addExtractInfoButton() {
            const checkInfo = setInterval(() => {
                const infoBtn = document.querySelector('.btn-info');
                if (infoBtn && !infoBtn.dataset.aiExtractAdded) {
                    // Ajouter un bouton dans le menu d'info ou créer un nouveau bouton
                    infoBtn.dataset.aiExtractAdded = 'true';
                    clearInterval(checkInfo);
                }
            }, 500);
        },
        
        /**
         * Obtenir l'ID de la note actuelle
         */
        getCurrentNoteId() {
            const noteElement = document.querySelector('.noteentry[data-note-id]');
            if (noteElement) {
                return noteElement.getAttribute('data-note-id');
            }
            
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('note');
        },
        
        /**
         * Échapper le HTML
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };
    
    // Initialiser au chargement
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof window.AIAssistant !== 'undefined') {
            AIIntegration.init();
        } else {
            // Attendre que AIAssistant soit chargé
            const checkAI = setInterval(() => {
                if (typeof window.AIAssistant !== 'undefined') {
                    AIIntegration.init();
                    clearInterval(checkAI);
                }
            }, 100);
        }
    });
    
    // Exposer globalement
    window.AIIntegration = AIIntegration;
})();

