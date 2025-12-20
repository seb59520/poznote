/**
 * Collapsible Sections (Notes dépliables) for Poznote
 * Enhanced version with nested sections, types, shortcuts, export/import, search, and statistics
 */

(function() {
    'use strict';

    // Section types
    const SECTION_TYPES = {
        default: { name: 'Défaut', class: '', color: '#000000' },
        warning: { name: 'Avertissement', class: 'section-warning', color: '#f59e0b' },
        info: { name: 'Info', class: 'section-info', color: '#3b82f6' },
        error: { name: 'Erreur', class: 'section-error', color: '#ef4444' }
    };

    /**
     * Generate a unique ID for a collapsible section
     */
    function generateSectionId() {
        return 'collapsible-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get current section type from context (check if inside another section)
     */
    function getCurrentSectionType() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return 'default';
        
        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentNode;
        
        const parentSection = container.closest && container.closest('.collapsible-section');
        if (parentSection) {
            // Inside a section - use same type or default
            const type = parentSection.getAttribute('data-section-type') || 'default';
            return type;
        }
        
        return 'default';
    }

    /**
     * Insert a collapsible section at the cursor position
     */
    function insertCollapsibleSection(title, type) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const sectionId = generateSectionId();
        const defaultTitle = title || 'Section dépliable';
        const sectionType = type || getCurrentSectionType();
        const typeInfo = SECTION_TYPES[sectionType] || SECTION_TYPES.default;

        // Check if we're inside another section (nested)
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentNode;
        const parentSection = container.closest && container.closest('.collapsible-body');
        const isNested = !!parentSection;

        // Create the collapsible section HTML structure
        const sectionHTML = `
            <div class="collapsible-section collapsed ${typeInfo.class}" data-section-id="${sectionId}" data-section-type="${sectionType}" ${isNested ? 'data-nested="true"' : ''}>
                <div class="collapsible-header" onclick="toggleCollapsibleSection('${sectionId}', event)">
                    <span class="collapsible-icon" id="icon-${sectionId}">▶</span>
                    <span class="collapsible-title" contenteditable="true" data-placeholder="Titre de la section">${defaultTitle}</span>
                    <div class="collapsible-actions">
                        <button class="collapsible-action-btn" onclick="changeSectionType('${sectionId}')" title="Changer le type">🎨</button>
                        <button class="collapsible-action-btn" onclick="insertNestedSection('${sectionId}')" title="Section imbriquée">📦</button>
                        <button class="collapsible-action-btn" onclick="exportSectionToMarkdown('${sectionId}')" title="Exporter en Markdown">📤</button>
                        <button class="collapsible-action-btn" onclick="duplicateCollapsibleSection('${sectionId}')" title="Dupliquer">📋</button>
                        <button class="collapsible-action-btn" onclick="deleteCollapsibleSection('${sectionId}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <div class="collapsible-content" id="content-${sectionId}" style="display: none;">
                    <div class="collapsible-body" contenteditable="true" data-placeholder="Contenu de la section...">
                        <br>
                    </div>
                </div>
            </div>
        `;

        // Create a temporary container to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHTML.trim();
        const sectionElement = tempDiv.firstElementChild;

        // Insert the section at cursor position
        if (isNested && parentSection) {
            // Insert inside parent section body
            const range2 = document.createRange();
            range2.selectNodeContents(parentSection);
            range2.collapse(false);
            range2.insertNode(sectionElement);
        } else {
            range.deleteContents();
            range.insertNode(sectionElement);
        }

        // Add a line break after the section
        const br = document.createElement('br');
        sectionElement.parentNode.insertBefore(br, sectionElement.nextSibling);

        // Place cursor in the title
        const titleElement = sectionElement.querySelector('.collapsible-title');
        if (titleElement) {
            const newRange = document.createRange();
            newRange.selectNodeContents(titleElement);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }

        // Trigger input event for autosave
        const noteEntry = sectionElement.closest('.noteentry');
        if (noteEntry) {
            noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
            updateSectionStatistics(noteEntry.getAttribute('data-note-id'));
        }

        // Initialize event handlers for the new section
        initializeCollapsibleSection(sectionId);
    }

    /**
     * Insert nested section inside a section
     */
    window.insertNestedSection = function(parentSectionId) {
        const parentSection = document.querySelector(`[data-section-id="${parentSectionId}"]`);
        if (!parentSection) return;
        
        const bodyElement = parentSection.querySelector('.collapsible-body');
        if (!bodyElement) return;
        
        // Open parent section if closed
        const content = document.getElementById('content-' + parentSectionId);
        if (content && content.style.display === 'none') {
            toggleCollapsibleSection(parentSectionId);
        }
        
        // Create range at end of body
        const range = document.createRange();
        range.selectNodeContents(bodyElement);
        range.collapse(false);
        
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Insert section
        insertCollapsibleSection('Section imbriquée', parentSection.getAttribute('data-section-type') || 'default');
    };

    /**
     * Change section type
     */
    window.changeSectionType = function(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;
        
        const currentType = section.getAttribute('data-section-type') || 'default';
        const types = Object.keys(SECTION_TYPES);
        const currentIndex = types.indexOf(currentType);
        const nextType = types[(currentIndex + 1) % types.length];
        const typeInfo = SECTION_TYPES[nextType];
        
        // Remove all type classes
        Object.values(SECTION_TYPES).forEach(t => {
            section.classList.remove(t.class);
        });
        
        // Add new type class
        if (typeInfo.class) {
            section.classList.add(typeInfo.class);
        }
        
        section.setAttribute('data-section-type', nextType);
        
        // Trigger autosave
        const noteEntry = section.closest('.noteentry');
        if (noteEntry) {
            noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    /**
     * Toggle a collapsible section (open/close)
     */
    window.toggleCollapsibleSection = function(sectionId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        const content = document.getElementById('content-' + sectionId);
        const icon = document.getElementById('icon-' + sectionId);
        
        if (!content || !icon || !section) return;

        const isOpen = !section.classList.contains('collapsed');
        
        if (isOpen) {
            // Close
            content.style.display = 'none';
            section.classList.remove('expanded');
            section.classList.add('collapsed');
            icon.textContent = '▶';
        } else {
            // Open
            content.style.display = 'block';
            section.classList.remove('collapsed');
            section.classList.add('expanded');
            icon.textContent = '▼';
        }

        // Save state to localStorage
        saveSectionState(sectionId, !isOpen);

        // Trigger input event for autosave
        const noteEntry = section.closest('.noteentry');
        if (noteEntry) {
            noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    /**
     * Toggle all sections in current note
     */
    window.toggleAllSections = function() {
        const activeNoteEntry = document.querySelector('.noteentry[contenteditable="true"]');
        if (!activeNoteEntry) {
            // Try to find any note entry
            const noteEntries = document.querySelectorAll('.noteentry');
            if (noteEntries.length === 0) return;
            activeNoteEntry = noteEntries[0];
        }
        
        const sections = activeNoteEntry.querySelectorAll('.collapsible-section');
        if (sections.length === 0) return;
        
        // Check if all are open or all are closed
        let allOpen = true;
        let allClosed = true;
        sections.forEach(section => {
            if (section.classList.contains('expanded')) allClosed = false;
            if (section.classList.contains('collapsed')) allOpen = false;
        });
        
        // Toggle all
        const shouldOpen = allClosed || (!allOpen && !allClosed);
        sections.forEach(section => {
            const sectionId = section.getAttribute('data-section-id');
            if (sectionId) {
                const content = document.getElementById('content-' + sectionId);
                const icon = document.getElementById('icon-' + sectionId);
                if (content && icon) {
                    if (shouldOpen && section.classList.contains('collapsed')) {
                        toggleCollapsibleSection(sectionId);
                    } else if (!shouldOpen && section.classList.contains('expanded')) {
                        toggleCollapsibleSection(sectionId);
                    }
                }
            }
        });
    };

    /**
     * Duplicate section with keyboard shortcut
     */
    window.duplicateCurrentSection = function() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType === 3) container = container.parentNode;
        
        const section = container.closest && container.closest('.collapsible-section');
        if (section) {
            const sectionId = section.getAttribute('data-section-id');
            if (sectionId) {
                duplicateCollapsibleSection(sectionId);
            }
        }
    };

    /**
     * Save section state to localStorage
     */
    function saveSectionState(sectionId, isOpen) {
        try {
            const noteEntry = document.querySelector(`[data-section-id="${sectionId}"]`).closest('.noteentry');
            if (!noteEntry) return;
            
            const noteId = noteEntry.getAttribute('data-note-id');
            if (!noteId) return;
            
            const key = `collapsible-state-${noteId}`;
            let states = {};
            try {
                const saved = localStorage.getItem(key);
                if (saved) {
                    states = JSON.parse(saved);
                }
            } catch (e) {}
            
            states[sectionId] = isOpen;
            localStorage.setItem(key, JSON.stringify(states));
        } catch (e) {
            console.error('Error saving section state:', e);
        }
    }

    /**
     * Restore section states from localStorage
     */
    function restoreSectionStates(noteId) {
        try {
            const key = `collapsible-state-${noteId}`;
            const saved = localStorage.getItem(key);
            if (!saved) return;
            
            const states = JSON.parse(saved);
            const noteEntry = document.getElementById('entry' + noteId);
            if (!noteEntry) return;
            
            Object.keys(states).forEach(function(sectionId) {
                const section = noteEntry.querySelector(`[data-section-id="${sectionId}"]`);
                if (!section) return;
                
                const content = document.getElementById('content-' + sectionId);
                const icon = document.getElementById('icon-' + sectionId);
                if (!content || !icon) return;
                
                const shouldBeOpen = states[sectionId];
                if (shouldBeOpen) {
                    content.style.display = 'block';
                    section.classList.remove('collapsed');
                    section.classList.add('expanded');
                    icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    section.classList.remove('expanded');
                    section.classList.add('collapsed');
                    icon.textContent = '▶';
                }
            });
        } catch (e) {
            console.error('Error restoring section states:', e);
        }
    }

    /**
     * Duplicate a collapsible section
     */
    window.duplicateCollapsibleSection = function(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;
        
        const titleElement = section.querySelector('.collapsible-title');
        const bodyElement = section.querySelector('.collapsible-body');
        const sectionType = section.getAttribute('data-section-type') || 'default';
        const typeInfo = SECTION_TYPES[sectionType] || SECTION_TYPES.default;
        const isNested = section.hasAttribute('data-nested');
        
        const title = titleElement ? titleElement.textContent.trim() : 'Section dépliable';
        const body = bodyElement ? bodyElement.innerHTML : '';
        
        // Insert after current section
        const newSectionId = generateSectionId();
        const sectionHTML = `
            <div class="collapsible-section collapsed ${typeInfo.class}" data-section-id="${newSectionId}" data-section-type="${sectionType}" ${isNested ? 'data-nested="true"' : ''}>
                <div class="collapsible-header" onclick="toggleCollapsibleSection('${newSectionId}', event)">
                    <span class="collapsible-icon" id="icon-${newSectionId}">▶</span>
                    <span class="collapsible-title" contenteditable="true" data-placeholder="Titre de la section">${title}</span>
                    <div class="collapsible-actions">
                        <button class="collapsible-action-btn" onclick="changeSectionType('${newSectionId}')" title="Changer le type">🎨</button>
                        <button class="collapsible-action-btn" onclick="insertNestedSection('${newSectionId}')" title="Section imbriquée">📦</button>
                        <button class="collapsible-action-btn" onclick="exportSectionToMarkdown('${newSectionId}')" title="Exporter en Markdown">📤</button>
                        <button class="collapsible-action-btn" onclick="duplicateCollapsibleSection('${newSectionId}')" title="Dupliquer">📋</button>
                        <button class="collapsible-action-btn" onclick="deleteCollapsibleSection('${newSectionId}')" title="Supprimer">🗑️</button>
                    </div>
                </div>
                <div class="collapsible-content" id="content-${newSectionId}" style="display: none;">
                    <div class="collapsible-body" contenteditable="true" data-placeholder="Contenu de la section...">${body}</div>
                </div>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = sectionHTML.trim();
        const newSection = tempDiv.firstElementChild;
        
        section.parentNode.insertBefore(newSection, section.nextSibling);
        
        // Add line break after
        const br = document.createElement('br');
        newSection.parentNode.insertBefore(br, newSection.nextSibling);
        
        initializeCollapsibleSection(newSectionId);
        
        // Trigger autosave
        const noteEntry = section.closest('.noteentry');
        if (noteEntry) {
            noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
            updateSectionStatistics(noteEntry.getAttribute('data-note-id'));
        }
    };

    /**
     * Delete a collapsible section
     */
    window.deleteCollapsibleSection = function(sectionId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        if (!confirm('Supprimer cette section dépliable ?')) {
            return;
        }
        
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;
        
        const noteEntry = section.closest('.noteentry');
        
        // Remove section and following line break if exists
        const nextSibling = section.nextSibling;
        section.remove();
        if (nextSibling && nextSibling.nodeName === 'BR') {
            nextSibling.remove();
        }
        
        // Trigger autosave
        if (noteEntry) {
            noteEntry.dispatchEvent(new Event('input', { bubbles: true }));
            updateSectionStatistics(noteEntry.getAttribute('data-note-id'));
        }
    };

    /**
     * Export section to Markdown
     */
    window.exportSectionToMarkdown = function(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;
        
        const titleElement = section.querySelector('.collapsible-title');
        const bodyElement = section.querySelector('.collapsible-body');
        
        const title = titleElement ? titleElement.textContent.trim() : 'Section';
        const body = bodyElement ? bodyElement.innerText : '';
        
        // Convert to markdown
        let markdown = `<details>\n<summary>${title}</summary>\n\n`;
        markdown += body.split('\n').map(line => line.trim() ? line : '').join('\n');
        markdown += '\n\n</details>';
        
        // Copy to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(markdown).then(() => {
                if (typeof showNotificationPopup === 'function') {
                    showNotificationPopup('Section exportée en Markdown dans le presse-papiers', 'success');
                } else {
                    alert('Section exportée en Markdown dans le presse-papiers');
                }
            }).catch(err => {
                console.error('Error copying to clipboard:', err);
                // Fallback: show in prompt
                prompt('Markdown (copiez le texte):', markdown);
            });
        } else {
            // Fallback: show in prompt
            prompt('Markdown (copiez le texte):', markdown);
        }
    };

    /**
     * Import section from Markdown
     */
    window.importSectionFromMarkdown = function(markdown) {
        // Parse markdown details/summary
        const detailsMatch = markdown.match(/<details>\s*<summary>(.*?)<\/summary>\s*(.*?)<\/details>/s);
        if (!detailsMatch) {
            alert('Format Markdown invalide. Utilisez: <details><summary>Titre</summary>Contenu</details>');
            return;
        }
        
        const title = detailsMatch[1].trim();
        const body = detailsMatch[2].trim();
        
        // Insert section
        insertCollapsibleSection(title);
        
        // Set body content
        setTimeout(() => {
            const sections = document.querySelectorAll('.collapsible-section');
            if (sections.length > 0) {
                const lastSection = sections[sections.length - 1];
                const bodyElement = lastSection.querySelector('.collapsible-body');
                if (bodyElement) {
                    bodyElement.innerHTML = body.replace(/\n/g, '<br>');
                }
            }
        }, 100);
    };

    /**
     * Search in sections (only open ones)
     */
    window.searchInSections = function(searchTerm) {
        const noteEntry = document.querySelector('.noteentry[contenteditable="true"]');
        if (!noteEntry) return [];
        
        const results = [];
        const sections = noteEntry.querySelectorAll('.collapsible-section.expanded');
        
        sections.forEach(section => {
            const titleElement = section.querySelector('.collapsible-title');
            const bodyElement = section.querySelector('.collapsible-body');
            
            const title = titleElement ? titleElement.textContent : '';
            const body = bodyElement ? bodyElement.textContent : '';
            
            const titleMatch = title.toLowerCase().includes(searchTerm.toLowerCase());
            const bodyMatch = body.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (titleMatch || bodyMatch) {
                results.push({
                    sectionId: section.getAttribute('data-section-id'),
                    title: title,
                    matches: {
                        title: titleMatch,
                        body: bodyMatch
                    }
                });
            }
        });
        
        return results;
    };

    /**
     * Update section statistics
     */
    function updateSectionStatistics(noteId) {
        const noteEntry = document.getElementById('entry' + noteId);
        if (!noteEntry) return;
        
        const sections = noteEntry.querySelectorAll('.collapsible-section');
        const stats = {
            total: sections.length,
            open: 0,
            closed: 0,
            nested: 0,
            totalChars: 0
        };
        
        sections.forEach(section => {
            if (section.classList.contains('expanded')) stats.open++;
            if (section.classList.contains('collapsed')) stats.closed++;
            if (section.hasAttribute('data-nested')) stats.nested++;
            
            const bodyElement = section.querySelector('.collapsible-body');
            if (bodyElement) {
                stats.totalChars += bodyElement.textContent.length;
            }
        });
        
        // Store stats
        try {
            localStorage.setItem(`section-stats-${noteId}`, JSON.stringify(stats));
        } catch (e) {}
        
        // Update UI if stats element exists
        const statsElement = document.getElementById('section-stats-' + noteId);
        if (statsElement) {
            statsElement.textContent = `${stats.total} sections (${stats.open} ouvertes, ${stats.closed} fermées${stats.nested > 0 ? ', ' + stats.nested + ' imbriquées' : ''}) - ${stats.totalChars} caractères`;
        }
        
        return stats;
    }

    /**
     * Get section statistics
     */
    window.getSectionStatistics = function(noteId) {
        const noteEntry = document.getElementById('entry' + noteId);
        if (!noteEntry) return null;
        
        return updateSectionStatistics(noteId);
    };

    /**
     * Initialize event handlers for a collapsible section
     */
    function initializeCollapsibleSection(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;

        // Prevent header editing from toggling the section
        const titleElement = section.querySelector('.collapsible-title');
        if (titleElement) {
            titleElement.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }

        // Prevent body editing from toggling the section
        const bodyElement = section.querySelector('.collapsible-body');
        if (bodyElement) {
            bodyElement.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            
            // Update stats on content change
            bodyElement.addEventListener('input', function() {
                const noteEntry = section.closest('.noteentry');
                if (noteEntry) {
                    const noteId = noteEntry.getAttribute('data-note-id');
                    if (noteId) {
                        updateSectionStatistics(noteId);
                    }
                }
            });
        }

        // Handle placeholder for title
        if (titleElement) {
            titleElement.addEventListener('focus', function() {
                if (this.textContent.trim() === 'Titre de la section') {
                    this.textContent = '';
                }
            });
            titleElement.addEventListener('blur', function() {
                if (this.textContent.trim() === '') {
                    this.textContent = 'Titre de la section';
                }
            });
        }

        // Handle placeholder for body
        if (bodyElement) {
            bodyElement.addEventListener('focus', function() {
                if (this.textContent.trim() === 'Contenu de la section...') {
                    this.textContent = '';
                }
            });
            bodyElement.addEventListener('blur', function() {
                if (this.textContent.trim() === '') {
                    this.textContent = 'Contenu de la section...';
                }
            });
        }
    }

    /**
     * Initialize all collapsible sections in a note
     */
    function initializeAllCollapsibleSections(noteId) {
        const noteEntry = document.getElementById('entry' + noteId);
        if (!noteEntry) return;

        const sections = noteEntry.querySelectorAll('.collapsible-section');
        sections.forEach(function(section) {
            const sectionId = section.getAttribute('data-section-id');
            if (sectionId) {
                initializeCollapsibleSection(sectionId);
            }
        });
        
        // Restore saved states
        restoreSectionStates(noteId);
        
        // Update statistics
        updateSectionStatistics(noteId);
    }

    /**
     * Keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+O: Toggle all sections
            if (e.ctrlKey && e.shiftKey && e.key === 'O') {
                e.preventDefault();
                window.toggleAllSections();
            }
            
            // Ctrl+D: Duplicate current section (only if cursor is in a section)
            if (e.ctrlKey && e.key === 'd' && !e.shiftKey) {
                const selection = window.getSelection();
                if (selection.rangeCount) {
                    const range = selection.getRangeAt(0);
                    let container = range.commonAncestorContainer;
                    if (container.nodeType === 3) container = container.parentNode;
                    
                    const section = container.closest && container.closest('.collapsible-section');
                    if (section) {
                        e.preventDefault();
                        const sectionId = section.getAttribute('data-section-id');
                        if (sectionId) {
                            duplicateCollapsibleSection(sectionId);
                        }
                    }
                }
            }
        });
    }

    /**
     * Export functions for global use
     */
    window.insertCollapsibleSection = insertCollapsibleSection;
    window.initializeCollapsibleSections = initializeAllCollapsibleSections;
    window.importSectionFromMarkdown = importSectionFromMarkdown;
    
    // Debug: verify function is exported
    console.log('Collapsible sections module loaded. insertCollapsibleSection available:', typeof window.insertCollapsibleSection === 'function');

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Auto-initialize sections when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize sections for all notes
            const noteEntries = document.querySelectorAll('.noteentry');
            noteEntries.forEach(function(entry) {
                const noteId = entry.getAttribute('data-note-id');
                if (noteId) {
                    initializeAllCollapsibleSections(noteId);
                }
            });
        });
    } else {
        // DOM already loaded
        const noteEntries = document.querySelectorAll('.noteentry');
        noteEntries.forEach(function(entry) {
            const noteId = entry.getAttribute('data-note-id');
            if (noteId) {
                initializeAllCollapsibleSections(noteId);
            }
        });
    }

    // Re-initialize when notes are loaded via AJAX
    if (typeof window.addEventListener !== 'undefined') {
        window.addEventListener('noteLoaded', function(e) {
            if (e.detail && e.detail.noteId) {
                setTimeout(function() {
                    initializeAllCollapsibleSections(e.detail.noteId);
                }, 100);
            }
        });
    }
})();
