/**
 * Collapsible Sections (Notes dépliables) for Poznote
 * Allows users to create expandable/collapsible sections in notes
 */

(function() {
    'use strict';

    /**
     * Generate a unique ID for a collapsible section
     */
    function generateSectionId() {
        return 'collapsible-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Insert a collapsible section at the cursor position
     */
    function insertCollapsibleSection(title) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const sectionId = generateSectionId();
        const defaultTitle = title || 'Section dépliable';

        // Create the collapsible section HTML structure
        const sectionHTML = `
            <div class="collapsible-section collapsed" data-section-id="${sectionId}">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('${sectionId}', event)">
                    <span class="collapsible-icon" id="icon-${sectionId}">▶</span>
                    <span class="collapsible-title" contenteditable="true" data-placeholder="Titre de la section">${defaultTitle}</span>
                    <div class="collapsible-actions">
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
        range.deleteContents();
        range.insertNode(sectionElement);

        // Add a line break after the section
        const br = document.createElement('br');
        range.setStartAfter(sectionElement);
        range.insertNode(br);

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
        }

        // Initialize event handlers for the new section
        initializeCollapsibleSection(sectionId);
    }

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
        
        const title = titleElement ? titleElement.textContent.trim() : 'Section dépliable';
        const body = bodyElement ? bodyElement.innerHTML : '';
        
        // Insert after current section
        const newSectionId = generateSectionId();
        const sectionHTML = `
            <div class="collapsible-section collapsed" data-section-id="${newSectionId}">
                <div class="collapsible-header" onclick="toggleCollapsibleSection('${newSectionId}', event)">
                    <span class="collapsible-icon" id="icon-${newSectionId}">▶</span>
                    <span class="collapsible-title" contenteditable="true" data-placeholder="Titre de la section">${title}</span>
                    <div class="collapsible-actions">
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
        }
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
    }

    /**
     * Export functions for global use
     */
    window.insertCollapsibleSection = insertCollapsibleSection;
    window.initializeCollapsibleSections = initializeAllCollapsibleSections;
    
    // Debug: verify function is exported
    console.log('Collapsible sections module loaded. insertCollapsibleSection available:', typeof window.insertCollapsibleSection === 'function');

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

