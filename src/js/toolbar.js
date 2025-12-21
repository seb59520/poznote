// Clean, popup-only color picker for the toolbar palette button.
// Exposes window.toggleRedColor() which is called from the toolbar button.

(function () {
  'use strict';

  const COLORS = [
    { name: 'Black', value: 'rgb(55,53,47)' },
    { name: 'Red', value: 'red' },
    { name: 'Orange', value: 'orange' },
    { name: 'Yellow', value: 'yellow' },
    { name: 'Green', value: 'green' },
    { name: 'Blue', value: 'blue' },
    { name: 'Purple', value: 'purple' },
    { name: 'None', value: 'none' }
  ];

  // Save/restore selection helpers
  function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      window.savedColorRange = sel.getRangeAt(0).cloneRange();
    } else {
      window.savedColorRange = null;
    }
  }

  function restoreSelection() {
    const r = window.savedColorRange;
    if (r) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
    }
    return false;
  }

  // Remove inline color styles in the selected range (best-effort)
  function removeInlineColorInRange(range) {
    try {
      const root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
      const toClean = [];
      while (walker.nextNode()) {
        const el = walker.currentNode;
        if (range.intersectsNode(el) && el.style && el.style.color) toClean.push(el);
      }
      toClean.forEach(el => {
        el.style.color = '';
        if (el.getAttribute('style') === '') el.removeAttribute('style');
      });
    } catch (e) {
      // swallow
    }
  }

  // Apply color (or remove it) to the saved selection
  function applyColorToSelection(color) {
    // restore selection first
    restoreSelection();

    try {
      // Prefer CSS styling for foreColor
      document.execCommand('styleWithCSS', false, true);
    } catch (e) {
      // ignore
    }

    if (color === 'none') {
      // Try to set to inherit and then remove inline styles where possible
      try {
        document.execCommand('foreColor', false, 'inherit');
      } catch (e) {
        // ignore
      }
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        removeInlineColorInRange(sel.getRangeAt(0));
      }
    } else {
      try {
        document.execCommand('foreColor', false, color);
      } catch (e) {
        // fallback: wrap selection in span with inline style
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.style.color = color;
          try {
            range.surroundContents(span);
          } catch (err) {
            // If surroundContents fails (partial selections), use insertNode
            const docFrag = range.cloneContents();
            span.appendChild(docFrag);
            range.deleteContents();
            range.insertNode(span);
          }
        }
      }
    }

    // trigger optional update callback if present
    const noteentry = document.querySelector('.noteentry');
    if (noteentry && typeof window.update === 'function') {
      window.update();
    }
  }

  // Remove any existing popup
  function removeExistingPopup() {
    const prev = document.querySelector('.color-palette-popup');
    if (prev) prev.remove();
    window.savedColorRange = null;
  }

  // Build popup DOM
  function buildPopup() {
    const popup = document.createElement('div');
    popup.className = 'color-palette-popup';
    const grid = document.createElement('div');
    grid.className = 'color-grid';

    COLORS.forEach(c => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'color-item';
      item.setAttribute('data-color', c.value);
      item.setAttribute('title', c.name);
      // Visual: a small swatch and label (screen readers)
      const sw = document.createElement('span');
      sw.className = 'color-swatch';
      sw.style.background = c.value === 'none' ? 'transparent' : c.value;
      if (c.value === 'none') {
        // Visual: neutral empty swatch with border (no cross)
        sw.style.border = '1px solid #ccc';
        sw.style.background = 'transparent';
        sw.style.display = 'inline-block';
      }
      sw.setAttribute('aria-hidden', 'true');
      item.appendChild(sw);
      item.appendChild(document.createTextNode(' '));
      grid.appendChild(item);
    });

    popup.appendChild(grid);
    return popup;
  }

  // Main entry: show popup centered under the palette button
  function toggleRedColor() {
    try {
      removeExistingPopup();
      saveSelection();

      const btn = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('btn-color')
        ? document.activeElement
        : document.querySelector('.btn-color');

      const popup = buildPopup();
      document.body.appendChild(popup);

      // Positioning: center under button
      const btnRect = btn ? btn.getBoundingClientRect() : { left: 10, right: 40, bottom: 40, width: 30 };
      const popupRect = popup.getBoundingClientRect();
      const left = btnRect.left + (btnRect.width / 2) - (popupRect.width / 2) + window.scrollX;
      const top = btnRect.bottom + 8 + window.scrollY;
      popup.style.position = 'absolute';
      popup.style.left = Math.max(8, left) + 'px';
      popup.style.top = top + 'px';

      // caret alignment variable for CSS if used
      const caretX = (btnRect.left + (btnRect.width / 2)) - (left);
      popup.style.setProperty('--caret-x', Math.max(8, caretX) + 'px');

      // show class for CSS transitions
      setTimeout(() => popup.classList.add('show'), 10);

      // Click handler
      popup.addEventListener('click', function (e) {
        const btnItem = e.target.closest('.color-item');
        if (!btnItem) return;
        const color = btnItem.getAttribute('data-color');
        applyColorToSelection(color);
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 160);
        window.savedColorRange = null;
      });

      // Close on outside click
      function outsideHandler(e) {
        if (!popup.contains(e.target) && !(e.target.closest && e.target.closest('.btn-color'))) {
          popup.classList.remove('show');
          setTimeout(() => popup.remove(), 160);
          document.removeEventListener('click', outsideHandler);
          document.removeEventListener('keydown', keyHandler);
          window.savedColorRange = null;
        }
      }

      function keyHandler(e) {
        if (e.key === 'Escape') {
          popup.classList.remove('show');
          setTimeout(() => popup.remove(), 160);
          document.removeEventListener('click', outsideHandler);
          document.removeEventListener('keydown', keyHandler);
          window.savedColorRange = null;
        }
      }

      setTimeout(() => document.addEventListener('click', outsideHandler), 20);
      document.addEventListener('keydown', keyHandler);

    } catch (err) {
      
    }
  }

  // Export
  window.toggleRedColor = toggleRedColor;
  // Also expose applyColorToSelection in case other scripts call it
  window.applyColorToSelection = applyColorToSelection;

})();
function toggleYellowHighlight() {
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    let allYellow = true, hasText = false;
    const treeWalker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node = treeWalker.currentNode;
    while(node) {
      if (node.nodeType === 3 && node.nodeValue.trim() !== '') {
        hasText = true;
        let parent = node.parentNode;
        let bg = '';
        if (parent && parent.style && parent.style.backgroundColor) bg = parent.style.backgroundColor.replace(/\s/g, '').toLowerCase();
        if (bg !== '#ffe066' && bg !== 'rgb(255,224,102)') allYellow = false;
      }
      node = treeWalker.nextNode();
    }
    document.execCommand('styleWithCSS', false, true);
    if (hasText && allYellow) {
      document.execCommand('hiliteColor', false, 'inherit');
    } else {
      document.execCommand('hiliteColor', false, '#ffe066');
    }
    document.execCommand('styleWithCSS', false, false);
  }
}

// Helper function to convert font size value to CSS size
function getFontSizeFromValue(value) {
  const sizeMap = {
    '1': '0.75rem',   // Very small
    '2': '0.875rem',  // Small  
    '3': '1rem',      // Normal
    '4': '1.125rem',  // Large
    '5': '1.5rem',    // Very large
    '6': '2rem',      // Huge
    '7': '3rem'       // Giant
  };
  return sizeMap[value] || '1rem';
}

function changeFontSize() {
  // Close any existing font size popup
  const existingPopup = document.querySelector('.font-size-popup');
  if (existingPopup) {
    existingPopup.remove();
    return;
  }

  // Save the current selection before opening popup
  const selection = window.getSelection();
  let savedRange = null;
  
  if (selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }
  
  // Check if we have selected text
  const hasSelection = savedRange && !savedRange.collapsed;
  
  if (!hasSelection) {
    // No selection - silently return
    return;
  }

  // Find the font size button to position the popup
  const fontSizeButton = document.querySelector('.btn-text-height');
  if (!fontSizeButton) return;

  // Create the popup
  const popup = document.createElement('div');
  popup.className = 'font-size-popup';
  
  // Font size options with labels
  const fontSizes = [
    { value: '1', label: 'Very small', preview: 'Aa' },
    { value: '2', label: 'Small', preview: 'Aa' },
    { value: '3', label: 'Normal', preview: 'Aa' },
    { value: '4', label: 'Large', preview: 'Aa' },
    { value: '5', label: 'Very large', preview: 'Aa' },
    { value: '6', label: 'Huge', preview: 'Aa' },
    { value: '7', label: 'Giant', preview: 'Aa' }
  ];

  // Build popup content
  let popupHTML = '';
  fontSizes.forEach(size => {
    popupHTML += `
      <div class="font-size-item" data-size="${size.value}">
        <span class="size-label">${size.label}</span>
        <span class="size-preview size-${size.value}">${size.preview}</span>
      </div>
    `;
  });
  
  popup.innerHTML = popupHTML;
  
  // Append popup to body and compute coordinates so it doesn't get clipped
  document.body.appendChild(popup);
  popup.style.position = 'absolute';
  popup.style.minWidth = '180px';

  // Position near the button but keep inside viewport
  const btnRect = fontSizeButton.getBoundingClientRect();
  const popupRectEstimate = { width: 220, height: (fontSizes.length * 44) };
  let left = btnRect.right - popupRectEstimate.width;
  if (left < 8) left = 8;
  let top = btnRect.bottom + 8;
  // If popup would overflow bottom, place it above the button
  if (top + popupRectEstimate.height > window.innerHeight - 8) {
    top = btnRect.top - popupRectEstimate.height - 8;
    if (top < 8) top = 8;
  }
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';

  // Show popup with animation
  setTimeout(() => {
    popup.classList.add('show');
  }, 10);

  // Add click handlers for font size items
  popup.querySelectorAll('.font-size-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const size = item.getAttribute('data-size');
      
      // Ensure editor has focus
      const editor = document.querySelector('[contenteditable="true"]');
      if (editor) {
        editor.focus();
        
        // Restore the saved selection
        if (savedRange) {
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(savedRange);
          // Apply font size to the restored selection
          document.execCommand('fontSize', false, size);
        }
      }
      
      // Close popup
      popup.classList.remove('show');
      setTimeout(() => {
        popup.remove();
      }, 200);
    });
  });

  // Close popup when clicking outside
  const closePopup = (e) => {
    if (!popup.contains(e.target) && !fontSizeButton.contains(e.target)) {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.remove();
      }, 200);
      document.removeEventListener('click', closePopup);
    }
  };
  
  // Add delay to prevent immediate closure
  setTimeout(() => {
    document.addEventListener('click', closePopup);
  }, 100);

  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      popup.classList.remove('show');
      setTimeout(() => {
        popup.remove();
      }, 200);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
}

function toggleCodeBlock() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentNode;
  
  // If already in a code block, remove it
  const existingPre = container.closest ? container.closest('pre') : null;
  if (existingPre) {
    const text = existingPre.textContent;
    existingPre.outerHTML = text.replace(/\n/g, '<br>');
    return;
  }
  
  // Find the note entry container
  const noteEntry = container.closest ? container.closest('.noteentry') : null;
  
  // Helper function to check if we're at the first line of the note
  function isAtFirstLine() {
    if (!noteEntry) return false;
    try {
      const rangeToStart = document.createRange();
      rangeToStart.setStart(noteEntry, 0);
      rangeToStart.setEnd(range.startContainer, range.startOffset);
      const textBefore = rangeToStart.toString();
      // Check if there's no text or only whitespace before the selection
      return !textBefore.trim();
    } catch (e) {
      return false;
    }
  }
  
  // Helper function to check if we're at the last line of the note
  function isAtLastLine() {
    if (!noteEntry) return false;
    try {
      const rangeToEnd = document.createRange();
      rangeToEnd.setStart(range.endContainer, range.endOffset);
      rangeToEnd.selectNodeContents(noteEntry);
      rangeToEnd.setStart(range.endContainer, range.endOffset);
      const textAfter = rangeToEnd.toString();
      // Check if there's no text or only whitespace after the selection
      return !textAfter.trim();
    } catch (e) {
      return false;
    }
  }
  
  const atFirstLine = isAtFirstLine();
  const atLastLine = isAtLastLine();
  
  // Otherwise, create a code block with the selected text
  if (sel.isCollapsed) {
    // No selection: insert empty block
    // Add blank line before only if at first line, after only if at last line
    const brBefore = atFirstLine ? '<br>' : '';
    const brAfter = atLastLine ? '<br>' : '';
    document.execCommand('insertHTML', false, `${brBefore}<pre class="code-block"><br></pre>${brAfter}`);
    return;
  }
  
  // Get selected text
  const selectedText = sel.toString();
  if (!selectedText.trim()) return;
  
  // Escape HTML and create code block
  const escapedText = selectedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Add blank line before only if at first line, after only if at last line
  const brBefore = atFirstLine ? '<br>' : '';
  const brAfter = atLastLine ? '<br>' : '';
  const codeHTML = `${brBefore}<pre class="code-block">${escapedText}</pre>${brAfter}`;
  document.execCommand('insertHTML', false, codeHTML);
}

function toggleInlineCode() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentNode;
  
  // Check if we're already in an inline code element
  const existingCode = container.closest ? container.closest('code') : null;
  if (existingCode && existingCode.tagName === 'CODE' && existingCode.parentNode.tagName !== 'PRE') {
    // We're in inline code, remove it
    const text = existingCode.textContent;
    existingCode.outerHTML = text;
    return;
  }
  
  // If no selection, insert empty inline code
  if (sel.isCollapsed) {
    document.execCommand('insertHTML', false, '<code></code>');
    // Position cursor inside the code
    const codeElement = container.querySelector('code:empty') || container.closest('.noteentry').querySelector('code:empty');
    if (codeElement) {
      const newRange = document.createRange();
      newRange.setStart(codeElement, 0);
      newRange.setEnd(codeElement, 0);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
    return;
  }
  
  // Get selected text
  const selectedText = sel.toString();
  if (!selectedText.trim()) return;
  
  // Check if we're dealing with a partial word with hyphens
  if (selectedText.indexOf('-') === -1 && // No hyphens in selection
      container.nodeType === 3 && // Text node
      container.textContent.indexOf('-') !== -1) { // Parent contains hyphens
    
    // Get the current word including hyphens
    const startPoint = range.startOffset;
    const endPoint = range.endOffset;
    const fullText = container.textContent;
    
    // Find word boundaries including hyphens
    let wordStart = startPoint;
    while (wordStart > 0 && /[\w\-]/.test(fullText.charAt(wordStart - 1))) {
      wordStart--;
    }
    
    let wordEnd = endPoint;
    while (wordEnd < fullText.length && /[\w\-]/.test(fullText.charAt(wordEnd))) {
      wordEnd++;
    }
    
    // If we found a larger word with hyphens, adjust the selection
    if (wordStart < startPoint || wordEnd > endPoint) {
      const newRange = document.createRange();
      newRange.setStart(container, wordStart);
      newRange.setEnd(container, wordEnd);
      sel.removeAllRanges();
      sel.addRange(newRange);
      
      // Get the new selected text
      const newSelectedText = sel.toString();
      
      // Escape HTML and create inline code for the new selection
      const escapedText = newSelectedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const codeHTML = `<code>${escapedText}</code>`;
      document.execCommand('insertHTML', false, codeHTML);
      return;
    }
  }
  
  // Escape HTML and create inline code for normal selections
  const escapedText = selectedText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  const codeHTML = `<code>${escapedText}</code>`;
  document.execCommand('insertHTML', false, codeHTML);
}

/**
 * Check if cursor is in an editable note area
 */
function isCursorInEditableNote() {
    const selection = window.getSelection();
    
    // Check if there's a selection/cursor
    if (!selection.rangeCount) {
        return false;
    }
    
    // Get the current element
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) { // Text node
        container = container.parentNode;
    }
    
    // Check if we're inside a contenteditable note area
    const editableElement = container.closest && container.closest('[contenteditable="true"]');
    const noteEntry = container.closest && container.closest('.noteentry');
    const markdownEditor = container.closest && container.closest('.markdown-editor');
    
    // Return true if we're in any editable note context
    return (editableElement && noteEntry) || markdownEditor || (editableElement && editableElement.classList.contains('noteentry'));
}

function insertSeparator() {
  // Check if cursor is in editable note
  if (!isCursorInEditableNote()) {
    window.showCursorWarning();
    return;
  }
  
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentNode;
  const noteentry = container.closest && container.closest('.noteentry');
  
  if (!noteentry) return;
  
  // Try execCommand first for browsers that still support it
  try {
    const hrHTML = '<hr style="border: none; border-top: 1px solid #bbb; margin: 12px 0;">';
    const success = document.execCommand('insertHTML', false, hrHTML);
    
    if (success) {
      // Trigger input event
      noteentry.dispatchEvent(new Event('input', {bubbles:true}));
      return;
    }
  } catch (e) {
    // execCommand failed, use manual approach
  }
  
  // Fallback: manual insertion with undo support via modern API
  const hr = document.createElement('hr');
  hr.style.border = 'none';
  hr.style.borderTop = '1px solid #bbb';
  hr.style.margin = '12px 0';
  
  // Trigger beforeinput event for undo history
  const beforeInputEvent = new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertText',
    data: null
  });
  
  if (noteentry.dispatchEvent(beforeInputEvent)) {
    // Insert the element
    if (!range.collapsed) {
      range.deleteContents();
    }
    range.insertNode(hr);
    
    // Position cursor after the HR
    range.setStartAfter(hr);
    range.setEndAfter(hr);
    sel.removeAllRanges();
    sel.addRange(range);
    
    // Trigger input event
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: null
    });
    noteentry.dispatchEvent(inputEvent);
  }
}

// Consolidated keydown handler for Enter behaviors
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  if (e.shiftKey) return; // allow newline with Shift+Enter

});

function toggleEmojiPicker() {
  const existingPicker = document.querySelector('.emoji-picker');
  
  if (existingPicker) {
    existingPicker.remove();
    window.savedEmojiRange = null;
    return;
  }

  // If the cursor is not in an editable note, warn immediately
  // instead of waiting until an emoji is selected.
  if (!isCursorInEditableNote()) {
    window.showCursorWarning();
    return;
  }

  // Save current selection so clicking inside the picker doesn't lose the caret.
  try {
    const sel = window.getSelection();
    window.savedEmojiRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  } catch (e) {
    window.savedEmojiRange = null;
  }
  
  // Create emoji popup
  const picker = document.createElement('div');
  picker.className = 'emoji-picker';
  
  // Emojis organized by categories
  const emojiCategories = {
    'Fréquents': ['😀', '😃', '😄', '😊', '😍', '😘', '😎', '🤔', '😅', '😂', '😢', '😭', '😡', '👍', '👎', '❤️', '✅', '❌', '❗', '❓', '⭐', '🔥', '💯', '💡', '⚡', '⚠️'],
    'Émotions': ['😀', '😃', '😄', '😁', '😆', '😊', '😍', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '😤', '😠', '😡', '🤬', '😶', '😐', '😑', '😯', '😦', '😧', '😮', '😲', '😱', '🤯', '😢', '😭', '😵', '😪', '😴', '🤤', '😌', '😛', '🤐', '🤫', '🤭', '🤗', '🤔'],
    'Actions': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦵', '🦶', '👂', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    'Symboles': ['✅', '❌', '✔️', '✖️', '❗', '❓', '❕', '❔', '⚠️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤'],
    'Objets': ['💡', '🔔', '🔍', '🔑', '⚙️', '🛠️', '📌', '📍', '📎', '📝', '📄', '📁', '📂', '📊', '📈', '📉', '📋', '📌', '📍', '📎', '🖇️', '📏', '📐', '✂️', '🗑️', '🔒', '🔓', '🔐', '🔑', '🗝️', '🔨', '🪓', '⛏️', '⚒️', '🛠️', '🔧', '🔩', '⚙️', '🧰', '🧲', '🔫', '💣', '🧨', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚿', '🛁', '🛀', '🧼', '🪒', '🧽', '🪣', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🪅', '🪡', '🧵', '🪢', '🧶', '🧷', '🧹', '🧺', '🧻', '🧼', '🧽', '🧯', '🛒', '🚬', '⚰️', '⚱️', '🗿', '🪧', '🪪', '🏧', '🚮', '🚰', '♿', '🚹', '🚺', '🚻', '🚼', '🚾', '🛂', '🛃', '🛄', '🛅', '⚠️', '🚸', '⛔', '🚫', '🚳', '🚭', '🚯', '🚱', '🚷', '📵', '🔞', '☢️', '☣️'],
    'Nature': ['🌱', '🌲', '🌳', '🌴', '🌵', '🌶️', '🌷', '🌸', '🌹', '🌺', '🌻', '🌼', '🌽', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍄', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🥝', '🍅', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫔', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊', '🥢', '🍽️', '🍴', '🥄', '🔪', '🏺'],
    'Animaux': ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲'],
    'Activités': ['🎯', '🎮', '🎲', '🧩', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🧵', '🪡', '🧶', '🎼', '🎵', '🎶', '🎤', '🎧', '📻', '🎷', '🪗', '🎸', '🪕', '🎹', '🎺', '🎻', '🥁', '🪘', '🪇', '🪈', '🎪', '🛝', '🎡', '🎢', '🎠', '🎟️', '🎫', '🎗️', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '⚾', '🥎', '🏀', '🏐', '🏈', '🏉', '🎾', '🥏', '🎳', '🏏', '🏑', '🏒', '🥍', '🏓', '🏸', '🥊', '🥋', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎯', '🪀', '🪁', '🎱', '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '🪅', '🪆', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🧵', '🪡', '🧶'],
    'Icônes': ['💡', '🔔', '⚡', '🔥', '⭐', '🌟', '💫', '✨', '💥', '💢', '💤', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💮', '🌐', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '🌝', '🌞', '⭐', '🌟', '🌠', '☀️', '⛅', '☁️', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌬️', '🌀', '🌈', '☂️', '☔', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌊']
  };

  // Font Awesome icons collection
  const iconCategories = {
    'Utiles': ['fa-lightbulb', 'fa-exclamation', 'fa-question', 'fa-info', 'fa-check', 'fa-times', 'fa-star', 'fa-heart', 'fa-bookmark', 'fa-flag', 'fa-tag', 'fa-bell', 'fa-bolt', 'fa-fire', 'fa-gem', 'fa-key', 'fa-lock', 'fa-unlock', 'fa-search', 'fa-filter', 'fa-cog', 'fa-wrench', 'fa-tools', 'fa-paperclip', 'fa-link', 'fa-share', 'fa-download', 'fa-upload', 'fa-copy', 'fa-paste', 'fa-cut', 'fa-edit', 'fa-trash', 'fa-save', 'fa-folder', 'fa-folder-open', 'fa-file', 'fa-file-alt', 'fa-image', 'fa-video', 'fa-music', 'fa-calendar', 'fa-clock', 'fa-user', 'fa-users', 'fa-envelope', 'fa-phone', 'fa-home', 'fa-globe', 'fa-map', 'fa-location-arrow', 'fa-compass'],
    'Actions': ['fa-play', 'fa-pause', 'fa-stop', 'fa-forward', 'fa-backward', 'fa-step-forward', 'fa-step-backward', 'fa-fast-forward', 'fa-fast-backward', 'fa-eject', 'fa-repeat', 'fa-shuffle', 'fa-random', 'fa-sync', 'fa-redo', 'fa-undo', 'fa-refresh', 'fa-spinner', 'fa-circle-notch', 'fa-cog', 'fa-settings', 'fa-sliders-h', 'fa-toggle-on', 'fa-toggle-off', 'fa-power-off', 'fa-plug', 'fa-battery-full', 'fa-battery-half', 'fa-battery-empty', 'fa-signal', 'fa-wifi', 'fa-bluetooth', 'fa-usb', 'fa-hdd', 'fa-server', 'fa-database', 'fa-cloud', 'fa-cloud-download', 'fa-cloud-upload', 'fa-sync-alt', 'fa-exchange-alt', 'fa-arrows-alt', 'fa-expand', 'fa-compress', 'fa-expand-arrows-alt', 'fa-compress-arrows-alt', 'fa-arrows-alt-v', 'fa-arrows-alt-h', 'fa-arrow-up', 'fa-arrow-down', 'fa-arrow-left', 'fa-arrow-right', 'fa-arrow-circle-up', 'fa-arrow-circle-down', 'fa-arrow-circle-left', 'fa-arrow-circle-right', 'fa-chevron-up', 'fa-chevron-down', 'fa-chevron-left', 'fa-chevron-right', 'fa-angle-up', 'fa-angle-down', 'fa-angle-left', 'fa-angle-right', 'fa-caret-up', 'fa-caret-down', 'fa-caret-left', 'fa-caret-right'],
    'Interface': ['fa-bars', 'fa-th', 'fa-th-large', 'fa-th-list', 'fa-list', 'fa-list-ul', 'fa-list-ol', 'fa-list-alt', 'fa-table', 'fa-columns', 'fa-window-maximize', 'fa-window-minimize', 'fa-window-restore', 'fa-window-close', 'fa-times-circle', 'fa-check-circle', 'fa-info-circle', 'fa-question-circle', 'fa-exclamation-circle', 'fa-exclamation-triangle', 'fa-ban', 'fa-lock', 'fa-unlock', 'fa-eye', 'fa-eye-slash', 'fa-filter', 'fa-search', 'fa-search-plus', 'fa-search-minus', 'fa-zoom-in', 'fa-zoom-out', 'fa-expand', 'fa-compress', 'fa-expand-alt', 'fa-compress-alt', 'fa-external-link', 'fa-external-link-alt', 'fa-external-link-square', 'fa-external-link-square-alt', 'fa-share', 'fa-share-alt', 'fa-share-square', 'fa-share-alt-square', 'fa-link', 'fa-unlink', 'fa-paperclip', 'fa-paper-plane', 'fa-envelope', 'fa-envelope-open', 'fa-inbox', 'fa-archive', 'fa-box', 'fa-box-open', 'fa-download', 'fa-upload', 'fa-download-alt', 'fa-upload-alt', 'fa-file-download', 'fa-file-upload', 'fa-save', 'fa-save-alt', 'fa-file', 'fa-file-alt', 'fa-file-archive', 'fa-file-code', 'fa-file-excel', 'fa-file-image', 'fa-file-pdf', 'fa-file-powerpoint', 'fa-file-video', 'fa-file-word', 'fa-folder', 'fa-folder-open', 'fa-folder-plus', 'fa-folder-minus', 'fa-folder-times', 'fa-folder-check'],
    'Communication': ['fa-comment', 'fa-comments', 'fa-comment-alt', 'fa-comments-alt', 'fa-comment-dots', 'fa-comments-dollar', 'fa-comment-medical', 'fa-comment-slash', 'fa-comments-alt', 'fa-envelope', 'fa-envelope-open', 'fa-envelope-square', 'fa-envelope-open-text', 'fa-at', 'fa-reply', 'fa-reply-all', 'fa-forward', 'fa-share', 'fa-share-alt', 'fa-share-square', 'fa-paper-plane', 'fa-bullhorn', 'fa-megaphone', 'fa-broadcast-tower', 'fa-rss', 'fa-rss-square', 'fa-podcast', 'fa-microphone', 'fa-microphone-alt', 'fa-microphone-slash', 'fa-volume-up', 'fa-volume-down', 'fa-volume-mute', 'fa-volume-off', 'fa-headphones', 'fa-headphones-alt', 'fa-phone', 'fa-phone-alt', 'fa-phone-square', 'fa-phone-square-alt', 'fa-phone-slash', 'fa-phone-volume', 'fa-fax', 'fa-address-book', 'fa-address-card', 'fa-id-card', 'fa-id-card-alt', 'fa-user', 'fa-user-alt', 'fa-user-circle', 'fa-user-friends', 'fa-user-group', 'fa-user-plus', 'fa-user-minus', 'fa-user-times', 'fa-user-check', 'fa-user-cog', 'fa-user-edit', 'fa-user-lock', 'fa-user-shield', 'fa-user-slash', 'fa-user-tag', 'fa-user-tie', 'fa-users', 'fa-users-cog', 'fa-user-md', 'fa-user-nurse', 'fa-user-graduate', 'fa-user-astronaut', 'fa-user-injured', 'fa-user-secret', 'fa-user-ninja', 'fa-user-robot'],
    'Médias': ['fa-image', 'fa-images', 'fa-photo-video', 'fa-camera', 'fa-camera-alt', 'fa-camera-retro', 'fa-camera-rotate', 'fa-film', 'fa-video', 'fa-video-slash', 'fa-video-plus', 'fa-video-square', 'fa-play', 'fa-pause', 'fa-stop', 'fa-forward', 'fa-backward', 'fa-step-forward', 'fa-step-backward', 'fa-fast-forward', 'fa-fast-backward', 'fa-eject', 'fa-repeat', 'fa-shuffle', 'fa-random', 'fa-music', 'fa-headphones', 'fa-headphones-alt', 'fa-microphone', 'fa-microphone-alt', 'fa-microphone-slash', 'fa-volume-up', 'fa-volume-down', 'fa-volume-mute', 'fa-volume-off', 'fa-broadcast-tower', 'fa-radio', 'fa-podcast', 'fa-rss', 'fa-rss-square', 'fa-tv', 'fa-desktop', 'fa-laptop', 'fa-tablet', 'fa-mobile', 'fa-mobile-alt', 'fa-mobile-android', 'fa-mobile-android-alt', 'fa-print', 'fa-print-alt', 'fa-scanner', 'fa-scanner-keyboard', 'fa-scanner-touchscreen', 'fa-keyboard', 'fa-mouse', 'fa-mouse-pointer', 'fa-hand-pointer', 'fa-hand-paper', 'fa-hand-rock', 'fa-hand-scissors', 'fa-hand-spock', 'fa-hand-lizard', 'fa-hand-peace', 'fa-hand-point-up', 'fa-hand-point-down', 'fa-hand-point-left', 'fa-hand-point-right', 'fa-hand-point-up', 'fa-thumbs-up', 'fa-thumbs-down', 'fa-thumbtack', 'fa-map-pin', 'fa-map-marker', 'fa-map-marker-alt', 'fa-location-arrow', 'fa-compass', 'fa-directions', 'fa-route', 'fa-sign', 'fa-traffic-light', 'fa-stop-sign', 'fa-parking', 'fa-marker', 'fa-highlighter', 'fa-pen', 'fa-pen-alt', 'fa-pen-fancy', 'fa-pen-nib', 'fa-pen-square', 'fa-pencil', 'fa-pencil-alt', 'fa-pencil-ruler', 'fa-eraser', 'fa-paint-brush', 'fa-paint-roller', 'fa-palette', 'fa-fill', 'fa-fill-drip', 'fa-brush', 'fa-spray-can', 'fa-stamp', 'fa-tint', 'fa-tint-slash', 'fa-droplet', 'fa-droplet-slash', 'fa-eye', 'fa-eye-dropper', 'fa-eye-slash', 'fa-glasses', 'fa-glasses-alt', 'fa-sunglasses', 'fa-goggles', 'fa-binoculars', 'fa-telescope', 'fa-microscope', 'fa-camera', 'fa-camera-alt', 'fa-camera-retro', 'fa-camera-rotate', 'fa-film', 'fa-video', 'fa-video-slash', 'fa-video-plus', 'fa-video-square', 'fa-photo-video', 'fa-images', 'fa-image', 'fa-portrait', 'fa-id-badge', 'fa-id-card', 'fa-id-card-alt', 'fa-address-card', 'fa-address-book', 'fa-user-circle', 'fa-user', 'fa-user-alt', 'fa-user-friends', 'fa-user-group', 'fa-user-plus', 'fa-user-minus', 'fa-user-times', 'fa-user-check', 'fa-user-cog', 'fa-user-edit', 'fa-user-lock', 'fa-user-shield', 'fa-user-slash', 'fa-user-tag', 'fa-user-tie', 'fa-users', 'fa-users-cog', 'fa-user-md', 'fa-user-nurse', 'fa-user-graduate', 'fa-user-astronaut', 'fa-user-injured', 'fa-user-secret', 'fa-user-ninja', 'fa-user-robot', 'fa-robot', 'fa-android', 'fa-apple', 'fa-windows', 'fa-linux', 'fa-chrome', 'fa-firefox', 'fa-safari', 'fa-edge', 'fa-opera', 'fa-internet-explorer', 'fa-html5', 'fa-css3', 'fa-css3-alt', 'fa-js', 'fa-js-square', 'fa-python', 'fa-java', 'fa-php', 'fa-react', 'fa-vuejs', 'fa-angular', 'fa-node', 'fa-node-js', 'fa-npm', 'fa-yarn', 'fa-git', 'fa-git-alt', 'fa-git-square', 'fa-github', 'fa-github-alt', 'fa-github-square', 'fa-gitlab', 'fa-bitbucket', 'fa-codepen', 'fa-stack-overflow', 'fa-stack-exchange', 'fa-free-code-camp', 'fa-dev', 'fa-medium', 'fa-blogger', 'fa-wordpress', 'fa-joomla', 'fa-drupal', 'fa-magento', 'fa-shopify', 'fa-woocommerce', 'fa-opencart', 'fa-prestashop', 'fa-buysellads', 'fa-cc-amazon-pay', 'fa-cc-amex', 'fa-cc-apple-pay', 'fa-cc-diners-club', 'fa-cc-discover', 'fa-cc-jcb', 'fa-cc-mastercard', 'fa-cc-paypal', 'fa-cc-stripe', 'fa-cc-visa', 'fa-amazon', 'fa-amazon-pay', 'fa-apple', 'fa-apple-pay', 'fa-google', 'fa-google-pay', 'fa-google-play', 'fa-google-wallet', 'fa-microsoft', 'fa-paypal', 'fa-shopify', 'fa-stripe', 'fa-visa', 'fa-mastercard', 'fa-amex', 'fa-discover', 'fa-diners-club', 'fa-jcb', 'fa-cc-amazon-pay', 'fa-cc-amex', 'fa-cc-apple-pay', 'fa-cc-diners-club', 'fa-cc-discover', 'fa-cc-jcb', 'fa-cc-mastercard', 'fa-cc-paypal', 'fa-cc-stripe', 'fa-cc-visa']
  };

  // Create picker content with tabs
  let content = '<div class="emoji-picker-header">';
  content += '<div class="emoji-tabs">';
  content += '<button class="emoji-tab active" data-tab="emojis">😀 Emojis</button>';
  content += '<button class="emoji-tab" data-tab="icons">🎨 Icônes</button>';
  content += '</div>';
  content += '<div class="emoji-search-container">';
  content += '<input type="text" class="emoji-search" placeholder="Rechercher..." />';
  content += '</div>';
  content += '</div>';
  
  // Emojis tab
  content += '<div class="emoji-tab-content active" data-content="emojis">';
  Object.keys(emojiCategories).forEach(category => {
    content += `<div class="emoji-category-section" data-category="${category}">`;
    content += `<div class="emoji-category-title">${category}</div>`;
    content += '<div class="emoji-grid">';
    emojiCategories[category].forEach(emoji => {
      content += `<span class="emoji-item" data-emoji="${emoji}" title="${emoji}">${emoji}</span>`;
    });
    content += '</div></div>';
  });
  content += '</div>';
  
  // Icons tab
  content += '<div class="emoji-tab-content" data-content="icons">';
  Object.keys(iconCategories).forEach(category => {
    content += `<div class="emoji-category-section" data-category="${category}">`;
    content += `<div class="emoji-category-title">${category}</div>`;
    content += '<div class="emoji-grid icon-grid">';
    iconCategories[category].forEach(iconClass => {
      const iconName = iconClass.replace('fa-', '').replace(/-/g, ' ');
      content += `<span class="emoji-item icon-item" data-icon="${iconClass}" title="${iconName}"><i class="fas ${iconClass}"></i></span>`;
    });
    content += '</div></div>';
  });
  content += '</div>';
  
  picker.innerHTML = content;
  
  // Position picker near emoji button
  document.body.appendChild(picker);
  
  // Position picker with overflow management
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const isMobile = isMobileDevice();

  let anchorRect = null;
  const emojiBtn = document.querySelector('.btn-emoji');
  if (emojiBtn) {
    const rect = emojiBtn.getBoundingClientRect();
    let isVisible = rect.width > 0 && rect.height > 0;
    try {
      const style = window.getComputedStyle(emojiBtn);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) isVisible = false;
    } catch (e) {}

    if (isVisible) {
      anchorRect = rect;
    }
  }

  if (!anchorRect) {
    try {
      const range = window.savedEmojiRange;
      if (range) {
        const rect = range.getBoundingClientRect();
        if (rect && (rect.top || rect.left || rect.bottom || rect.right)) {
          anchorRect = rect;
        } else {
          const rects = range.getClientRects();
          if (rects && rects.length) anchorRect = rects[0];
        }
      }
    } catch (e) {}
  }

  // Picker dimensions according to screen
  const pickerWidth = isMobile ? Math.min(300, windowWidth - 40) : 360;
  const pickerHeight = isMobile ? 450 : 550;
  picker.style.position = 'fixed';
  picker.style.width = pickerWidth + 'px';
  picker.style.maxHeight = pickerHeight + 'px';

  if (anchorRect) {
    const rect = anchorRect;
    
    // Calculate vertical position
    let top = rect.bottom + 10;
    if (top + pickerHeight > windowHeight - 20) {
      // If picker overflows bottom, place above button
      top = rect.top - pickerHeight - 10;
      if (top < 20) {
        // If it doesn't fit above either, center vertically
        top = Math.max(20, (windowHeight - pickerHeight) / 2);
      }
    }
    
    // Calculate horizontal position
    let left;
    if (isMobile) {
      // On mobile, center in screen
      left = (windowWidth - pickerWidth) / 2;
    } else {
      // On desktop, center on anchor
      left = rect.left - (pickerWidth / 2) + (rect.width / 2);
      if (left + pickerWidth > windowWidth - 20) {
        left = windowWidth - pickerWidth - 20;
      }
      if (left < 20) {
        left = 20;
      }
    }
    
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
  } else {
    // Fallback: center on screen
    picker.style.top = Math.max(20, (windowHeight - pickerHeight) / 2) + 'px';
    picker.style.left = Math.max(20, (windowWidth - pickerWidth) / 2) + 'px';
  }
  
  // Handle tab switching
  picker.addEventListener('click', function(e) {
    if (e.target.classList.contains('emoji-tab')) {
      const tab = e.target.getAttribute('data-tab');
      picker.querySelectorAll('.emoji-tab').forEach(t => t.classList.remove('active'));
      picker.querySelectorAll('.emoji-tab-content').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      picker.querySelector(`[data-content="${tab}"]`).classList.add('active');
    }
  });

  // Handle search
  const searchInput = picker.querySelector('.emoji-search');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      const searchTerm = e.target.value.toLowerCase();
      const activeTab = picker.querySelector('.emoji-tab.active').getAttribute('data-tab');
      const activeContent = picker.querySelector(`[data-content="${activeTab}"]`);
      
      activeContent.querySelectorAll('.emoji-category-section').forEach(section => {
        const items = section.querySelectorAll('.emoji-item');
        let hasMatch = false;
        items.forEach(item => {
          const emoji = item.getAttribute('data-emoji') || '';
          const icon = item.getAttribute('data-icon') || '';
          const title = item.getAttribute('title') || '';
          const text = (emoji + icon + title).toLowerCase();
          
          if (text.includes(searchTerm)) {
            item.style.display = 'flex';
            hasMatch = true;
          } else {
            item.style.display = 'none';
          }
        });
        section.style.display = hasMatch ? 'block' : 'none';
      });
    });
  }

  // Handle emoji/icon clicks
  picker.addEventListener('click', function(e) {
    const item = e.target.closest('.emoji-item');
    if (item) {
      const emoji = item.getAttribute('data-emoji');
      const icon = item.getAttribute('data-icon');
      
      if (emoji) {
        insertEmoji(emoji);
      } else if (icon) {
        insertIcon(icon);
      }
      picker.remove();
    }
  });
  
  // Close picker when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeEmojiPicker(e) {
      if (!picker.contains(e.target) && !e.target.closest('.btn-emoji')) {
        picker.remove();
        window.savedEmojiRange = null;
        document.removeEventListener('click', closeEmojiPicker);
      }
    });
  }, 100);
}

function insertEmoji(emoji) {
  // Restore selection saved when opening the picker.
  const sel = window.getSelection();
  try {
    if (window.savedEmojiRange) {
      sel.removeAllRanges();
      sel.addRange(window.savedEmojiRange);
    }
  } catch (e) {}

  // Ensure focus is back on the editor before inserting.
  try {
    if (sel && sel.rangeCount) {
      const rangeForFocus = sel.getRangeAt(0);
      let focusContainer = rangeForFocus.commonAncestorContainer;
      if (focusContainer && focusContainer.nodeType === 3) focusContainer = focusContainer.parentNode;
      const focusTarget = (focusContainer && focusContainer.closest && (focusContainer.closest('.markdown-editor') || focusContainer.closest('[contenteditable="true"]')));
      if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (e) {
          focusTarget.focus();
        }
      }
    }
  } catch (e) {}

  // Vérifier si le curseur est dans une zone éditable
  if (!isCursorInEditableNote()) {
    window.showCursorWarning();
    window.savedEmojiRange = null;
    return;
  }
  
  if (!sel.rangeCount) return;
  
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentNode;
  const noteentry = container.closest && container.closest('.noteentry');
  
  if (!noteentry) return;
  
  // Insert emoji
  document.execCommand('insertText', false, emoji);

  window.savedEmojiRange = null;
  
  // Trigger input event
  if (noteentry) {
    noteentry.dispatchEvent(new Event('input', {bubbles: true}));
  }
}

function insertIcon(iconClass) {
  // Restore selection saved when opening the picker.
  const sel = window.getSelection();
  try {
    if (window.savedEmojiRange) {
      sel.removeAllRanges();
      sel.addRange(window.savedEmojiRange);
    }
  } catch (e) {}

  // Ensure focus is back on the editor before inserting.
  try {
    if (sel && sel.rangeCount) {
      const rangeForFocus = sel.getRangeAt(0);
      let focusContainer = rangeForFocus.commonAncestorContainer;
      if (focusContainer && focusContainer.nodeType === 3) focusContainer = focusContainer.parentNode;
      const focusTarget = (focusContainer && focusContainer.closest && (focusContainer.closest('.markdown-editor') || focusContainer.closest('[contenteditable="true"]')));
      if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (e) {
          focusTarget.focus();
        }
      }
    }
  } catch (e) {}

  // Vérifier si le curseur est dans une zone éditable
  if (!isCursorInEditableNote()) {
    window.showCursorWarning();
    window.savedEmojiRange = null;
    return;
  }
  
  if (!sel.rangeCount) return;
  
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentNode;
  const noteentry = container.closest && container.closest('.noteentry');
  
  if (!noteentry) return;
  
  // Insert icon as HTML
  const iconHTML = `<i class="fa ${iconClass}"></i>`;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = iconHTML;
  const iconElement = tempDiv.firstElementChild;
  
  range.deleteContents();
  range.insertNode(iconElement);
  
  // Move cursor after icon
  range.setStartAfter(iconElement);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);

  window.savedEmojiRange = null;
  
  // Trigger input event
  if (noteentry) {
    noteentry.dispatchEvent(new Event('input', {bubbles: true}));
  }
}

// Ensure functions are available in global scope
window.insertSeparator = insertSeparator;

// Link insertion functionality
function addLinkToNote() {
  try {
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed;
    const selectedText = hasSelection ? sel.toString() : '';
    
    // Check if the selection is within an existing link
    let existingLink = null;
    let existingUrl = 'https://';
    
    if (hasSelection) {
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      // Check if the selection is inside a link element
      if (container.nodeType === Node.TEXT_NODE) {
        existingLink = container.parentElement.closest('a');
      } else if (container.nodeType === Node.ELEMENT_NODE) {
        existingLink = container.closest('a');
      }
      
      // If we found an existing link, get its URL
      if (existingLink && existingLink.href) {
        existingUrl = existingLink.href;
      }
    }
    
    // Save the current selection before opening modal to preserve it
    if (hasSelection) {
      window.savedLinkRange = sel.getRangeAt(0).cloneRange();
      window.savedExistingLink = existingLink;
    } else {
      window.savedLinkRange = null;
      window.savedExistingLink = null;
    }
    
    showLinkModal(existingUrl, selectedText, function(url, text) {
      // If url is null, it means we want to remove the link
      if (url === null) {
        if (window.savedExistingLink) {
          // Remove the link but keep the text content
          const linkText = window.savedExistingLink.textContent;
          const textNode = document.createTextNode(linkText);
          window.savedExistingLink.parentNode.replaceChild(textNode, window.savedExistingLink);
          
          // Save the note automatically
          const noteentry = document.querySelector('.noteentry');
          if (noteentry && typeof window.saveNoteImmediately === 'function') {
            window.saveNoteImmediately();
          }
        }
        
        // Clean up
        window.savedLinkRange = null;
        window.savedExistingLink = null;
        return;
      }
      
      if (!url) return;
      
      // If we're editing an existing link, just update it
      if (window.savedExistingLink) {
        window.savedExistingLink.href = url;
        if (text) {
          window.savedExistingLink.textContent = text;
        }
      } else {
        // Create a new link element
        const a = document.createElement('a');
        a.href = url;
        a.textContent = text;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        
        if (window.savedLinkRange) {
          // Restore the saved selection and replace it with the link
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(window.savedLinkRange);
          
          // Replace the selected text with the link
          window.savedLinkRange.deleteContents();
          window.savedLinkRange.insertNode(a);
          
          // Clear selection and position cursor after the link
          sel.removeAllRanges();
          const newRange = document.createRange();
          newRange.setStartAfter(a);
          newRange.setEndAfter(a);
          sel.addRange(newRange);
        } else {
          // No saved selection, insert at current cursor position or end of editor
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.insertNode(a);
            // Position cursor after the link
            range.setStartAfter(a);
            range.setEndAfter(a);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            // Fallback: append to editor
            const noteentry = document.querySelector('.noteentry');
            if (noteentry) {
              noteentry.appendChild(a);
            }
          }
        }
      }
      
      // Save the note automatically
      const noteentry = document.querySelector('.noteentry');
      if (noteentry && typeof window.saveNoteImmediately === 'function') {
        window.saveNoteImmediately();
      }
      
      // Clean up saved range and existing link reference
      window.savedLinkRange = null;
      window.savedExistingLink = null;
    });
  } catch (err) {
    console.error('Error in addLinkToNote:', err);
  }
}

function createLinkFromModal() {
  // Backwards-compatible stub: fallback to addLinkToNote behaviour
  return addLinkToNote();
}

function toggleTablePicker() {
  const existingPicker = document.querySelector('.table-picker-popup');
  
  if (existingPicker) {
    existingPicker.remove();
    return;
  }
  
  // Check if cursor is in editable note BEFORE opening picker
  if (!isCursorInEditableNote()) {
    window.showCursorWarning();
    return;
  }
  
  // Save current selection/cursor position
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    window.savedTableRange = sel.getRangeAt(0).cloneRange();
  } else {
    window.savedTableRange = null;
  }
  
  // Create table picker popup
  const picker = document.createElement('div');
  picker.className = 'table-picker-popup';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'table-picker-header';
  header.textContent = 'Insert Table';
  picker.appendChild(header);
  
  // Create grid container
  const grid = document.createElement('div');
  grid.className = 'table-picker-grid';
  
  const maxRows = 10;
  const maxCols = 10;
  
  // Create grid cells
  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col < maxCols; col++) {
      const cell = document.createElement('div');
      cell.className = 'table-picker-cell';
      cell.dataset.row = row + 1;
      cell.dataset.col = col + 1;
      grid.appendChild(cell);
    }
  }
  
  picker.appendChild(grid);
  
  // Create label
  const label = document.createElement('div');
  label.className = 'table-picker-label';
  label.textContent = '1 × 1';
  picker.appendChild(label);
  
  // Create direct input section
  const inputSection = document.createElement('div');
  inputSection.className = 'table-picker-input-section';
  
  const inputLabel = document.createElement('div');
  inputLabel.className = 'table-picker-input-label';
  inputLabel.textContent = 'Or enter dimensions:';
  inputSection.appendChild(inputLabel);
  
  const inputContainer = document.createElement('div');
  inputContainer.className = 'table-picker-input-container';
  
  // Rows input
  const rowsWrapper = document.createElement('div');
  rowsWrapper.className = 'table-picker-input-wrapper';
  
  const rowsLabel = document.createElement('label');
  rowsLabel.textContent = 'Rows:';
  rowsLabel.className = 'table-picker-input-field-label';
  rowsWrapper.appendChild(rowsLabel);
  
  const rowsInput = document.createElement('input');
  rowsInput.type = 'number';
  rowsInput.className = 'table-picker-input-field';
  rowsInput.min = '1';
  rowsInput.max = '20';
  rowsInput.value = '3';
  rowsInput.placeholder = 'Rows';
  rowsWrapper.appendChild(rowsInput);
  
  inputContainer.appendChild(rowsWrapper);
  
  // Columns input
  const colsWrapper = document.createElement('div');
  colsWrapper.className = 'table-picker-input-wrapper';
  
  const colsLabel = document.createElement('label');
  colsLabel.textContent = 'Cols:';
  colsLabel.className = 'table-picker-input-field-label';
  colsWrapper.appendChild(colsLabel);
  
  const colsInput = document.createElement('input');
  colsInput.type = 'number';
  colsInput.className = 'table-picker-input-field';
  colsInput.min = '1';
  colsInput.max = '20';
  colsInput.value = '3';
  colsInput.placeholder = 'Cols';
  colsWrapper.appendChild(colsInput);
  
  inputContainer.appendChild(colsWrapper);
  
  // Insert button
  const insertBtn = document.createElement('button');
  insertBtn.className = 'table-picker-insert-btn';
  insertBtn.textContent = 'Insert';
  inputContainer.appendChild(insertBtn);
  
  inputSection.appendChild(inputContainer);
  picker.appendChild(inputSection);
  
  // Append to body
  document.body.appendChild(picker);
  
  // Position picker near table button
  const tableBtn = document.querySelector('.btn-table');
  if (tableBtn) {
    const rect = tableBtn.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const isMobile = isMobileDevice();
    
    // Picker dimensions
    const pickerWidth = isMobile ? Math.min(280, windowWidth - 40) : 320;
    const pickerHeight = 320;
    
    picker.style.position = 'fixed';
    picker.style.width = pickerWidth + 'px';
    
    // Calculate vertical position
    let top = rect.bottom + 10;
    if (top + pickerHeight > windowHeight - 20) {
      // If picker overflows bottom, place above button
      top = rect.top - pickerHeight - 10;
      if (top < 20) {
        // If it doesn't fit above either, center vertically
        top = Math.max(20, (windowHeight - pickerHeight) / 2);
      }
    }
    
    // Calculate horizontal position
    let left;
    if (isMobile) {
      // On mobile, center in screen
      left = (windowWidth - pickerWidth) / 2;
    } else {
      // On desktop, center on button
      left = rect.left - (pickerWidth / 2) + (rect.width / 2);
      if (left + pickerWidth > windowWidth - 20) {
        left = windowWidth - pickerWidth - 20;
      }
      if (left < 20) {
        left = 20;
      }
    }
    
    picker.style.top = top + 'px';
    picker.style.left = left + 'px';
  }
  
  // Show picker with animation
  setTimeout(() => {
    picker.classList.add('show');
  }, 10);
  
  // Handle hover over grid
  let currentRows = 0;
  let currentCols = 0;
  
  grid.addEventListener('mouseover', function(e) {
    if (e.target.classList.contains('table-picker-cell')) {
      const row = parseInt(e.target.dataset.row);
      const col = parseInt(e.target.dataset.col);
      
      currentRows = row;
      currentCols = col;
      
      // Highlight cells
      const cells = grid.querySelectorAll('.table-picker-cell');
      cells.forEach(cell => {
        const cellRow = parseInt(cell.dataset.row);
        const cellCol = parseInt(cell.dataset.col);
        
        if (cellRow <= row && cellCol <= col) {
          cell.classList.add('highlighted');
        } else {
          cell.classList.remove('highlighted');
        }
      });
      
      // Update label
      label.textContent = `${row} × ${col}`;
    }
  });
  
  // Handle click on grid
  grid.addEventListener('click', function(e) {
    if (e.target.classList.contains('table-picker-cell')) {
      const rows = parseInt(e.target.dataset.row);
      const cols = parseInt(e.target.dataset.col);
      
      insertTable(rows, cols);
      picker.classList.remove('show');
      setTimeout(() => {
        picker.remove();
      }, 200);
    }
  });
  
  // Handle insert button click
  insertBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    let rows = parseInt(rowsInput.value);
    let cols = parseInt(colsInput.value);
    
    // Validate inputs
    if (isNaN(rows) || rows < 1) rows = 1;
    if (isNaN(cols) || cols < 1) cols = 1;
    if (rows > 20) rows = 20;
    if (cols > 20) cols = 20;
    
    insertTable(rows, cols);
    picker.classList.remove('show');
    setTimeout(() => {
      picker.remove();
    }, 200);
  });
  
  // Handle Enter key in input fields
  const handleInputEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      insertBtn.click();
    }
  };
  
  rowsInput.addEventListener('keydown', handleInputEnter);
  colsInput.addEventListener('keydown', handleInputEnter);
  
  // Close picker when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeTablePicker(e) {
      if (!picker.contains(e.target) && !e.target.closest('.btn-table')) {
        picker.classList.remove('show');
        setTimeout(() => {
          picker.remove();
        }, 200);
        document.removeEventListener('click', closeTablePicker);
      }
    });
  }, 100);
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      picker.classList.remove('show');
      setTimeout(() => {
        picker.remove();
      }, 200);
      document.removeEventListener('keydown', handleEscape);
    }
  };
  
  document.addEventListener('keydown', handleEscape);
}

function insertTable(rows, cols) {
  // Use saved range if available, otherwise check current cursor position
  if (window.savedTableRange) {
    // Restore the saved selection
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(window.savedTableRange);
    
    // Clear the saved range
    window.savedTableRange = null;
  } else {
    // Fallback: check if cursor is in editable note
    if (!isCursorInEditableNote()) {
      window.showCursorWarning();
      return;
    }
  }
  
  // Find the active note editor
  const noteentry = document.querySelector('.noteentry[contenteditable="true"]');
  
  if (!noteentry) {
    console.error('No editable note found');
    return;
  }
  
  // Focus the editor first
  noteentry.focus();
  
  // Build table HTML
  let tableHTML = '<table class="inserted-table" style="border-collapse: collapse; width: 100%; margin: 12px 0;">';
  tableHTML += '<tbody>';
  
  for (let r = 0; r < rows; r++) {
    tableHTML += '<tr>';
    for (let c = 0; c < cols; c++) {
      tableHTML += '<td style="border: 1px solid #ddd; padding: 8px; min-width: 50px;">';
      if (r === 0 && c === 0) {
        tableHTML += '&nbsp;'; // Non-breaking space for first cell
      } else {
        tableHTML += '&nbsp;';
      }
      tableHTML += '</td>';
    }
    tableHTML += '</tr>';
  }
  
  tableHTML += '</tbody></table><p><br></p>'; // Add paragraph after table
  
  // Insert table at saved cursor position
  try {
    let insertSuccess = false;
    
    // Try to restore the saved range
    if (window.savedTableRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(window.savedTableRange);
      
      // Try to insert at the saved position
      insertSuccess = document.execCommand('insertHTML', false, tableHTML);
      
      // Clean up saved range
      window.savedTableRange = null;
    } else {
      // No saved range, try current selection
      const sel = window.getSelection();
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        
        // Make sure we're inside the noteentry
        if (noteentry.contains(range.commonAncestorContainer) || noteentry === range.commonAncestorContainer) {
          insertSuccess = document.execCommand('insertHTML', false, tableHTML);
        }
      }
    }
    
    // If insertHTML didn't work, use fallback insertion
    if (!insertSuccess) {
      const sel = window.getSelection();
      let range;
      
      if (window.savedTableRange) {
        range = window.savedTableRange;
        window.savedTableRange = null;
      } else if (sel.rangeCount > 0) {
        range = sel.getRangeAt(0);
      } else {
        // Create a range at the end of noteentry
        range = document.createRange();
        range.selectNodeContents(noteentry);
        range.collapse(false);
      }
      
      // Manual insertion using range
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tableHTML;
      const table = tempDiv.firstChild;
      
      if (range) {
        range.deleteContents();
        range.insertNode(table);
        
        // Move cursor after the table
        range.setStartAfter(table);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    
    // Trigger input event to save
    noteentry.dispatchEvent(new Event('input', {bubbles: true}));
    
    // Focus on first cell
    setTimeout(() => {
      const insertedTable = noteentry.querySelector('table.inserted-table:last-of-type');
      if (insertedTable) {
        const firstCell = insertedTable.querySelector('td');
        if (firstCell) {
          // Place cursor in first cell
          firstCell.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(firstCell);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 100);
    
  } catch (e) {
    console.error('Error inserting table:', e);
    
    // Final fallback: append to end of noteentry
    try {
      noteentry.insertAdjacentHTML('beforeend', tableHTML);
      noteentry.dispatchEvent(new Event('input', {bubbles: true}));
      window.savedTableRange = null;
    } catch (fallbackError) {
      console.error('Fallback insertion also failed:', fallbackError);
      window.savedTableRange = null;
    }
  }
}

// Helper function to detect mobile device (reuse if already exists)
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}

// Ensure all toolbar functions are available in global scope
window.addLinkToNote = addLinkToNote;
window.toggleRedColor = toggleRedColor;
window.toggleYellowHighlight = toggleYellowHighlight;
window.changeFontSize = changeFontSize;
window.toggleCodeBlock = toggleCodeBlock;
window.toggleInlineCode = toggleInlineCode;
window.toggleEmojiPicker = toggleEmojiPicker;
window.insertEmoji = insertEmoji;
window.toggleTablePicker = toggleTablePicker;
window.insertTable = insertTable;

// ===== CHECKLIST FEATURE =====

/**
 * Serialize checklist inputs into the HTML content before saving
 * This converts <input> values into displayable text so they persist after page reload
 */
function serializeChecklistsBeforeSave(noteentry) {
  if (!noteentry) return;
  
  const checklists = noteentry.querySelectorAll('.checklist');
  checklists.forEach(function(checklist) {
    const items = checklist.querySelectorAll('.checklist-item');
    items.forEach(function(item) {
      const checkbox = item.querySelector('.checklist-checkbox');
      const input = item.querySelector('.checklist-input');
      if (checkbox && input) {
        // Create visual representation of checklist item
        const isChecked = checkbox.checked;
        const text = input.value || '';
        
        // Store in data attributes for recovery on reload
        checkbox.setAttribute('data-checked', isChecked ? '1' : '0');
        input.setAttribute('data-value', text);
        
        // IMPORTANT: Set the 'checked' attribute so it persists in the HTML
        if (isChecked) {
          checkbox.setAttribute('checked', 'checked');
          item.classList.add('checklist-item-checked');
        } else {
          checkbox.removeAttribute('checked');
          item.classList.remove('checklist-item-checked');
        }
      }
    });
  });
}

// Hook into the save process - wrap the original updatenote to serialize checklists first
if (!window._checklistSaveHookInstalled) {
  window._checklistSaveHookInstalled = true;
  
  // Hook for legacy updatenote function
  const originalSaveNoteImmediately = window.saveNoteImmediately;
  window.saveNoteImmediately = function() {
    const noteentry = document.querySelector('.noteentry');
    if (noteentry) {
      serializeChecklistsBeforeSave(noteentry);
    }
    
    if (typeof originalSaveNoteImmediately === 'function') {
      originalSaveNoteImmediately();
    } else if (typeof saveNoteToServer === 'function') {
      saveNoteToServer();
    }
  };
  
  // Hook for markNoteAsModified function
  if (typeof window.markNoteAsModified === 'function') {
    const originalMarkNoteAsModified = window.markNoteAsModified;
    window.markNoteAsModified = function() {
      const noteentry = document.querySelector('.noteentry');
      if (noteentry) {
        serializeChecklistsBeforeSave(noteentry);
      }
      return originalMarkNoteAsModified();
    };
  }
}

/**
 * Insert a checklist at the cursor position (starts with 1 item)
 */
function insertChecklist() {
  // Check if cursor is in editable note
  if (!isCursorInEditableNote()) {
    window.showCursorWarning();
    return;
  }

  const sel = window.getSelection();
  if (!sel.rangeCount) {
    window.showCursorWarning();
    return;
  }

  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentNode;
  const noteentry = container.closest && container.closest('.noteentry');

  if (!noteentry) {
    window.showCursorWarning();
    return;
  }
  
  // Create checklist HTML with 1 item only - using simple input
  const checklistHTML = `
<ul class="checklist" style="list-style: none; padding-left: 0; margin: 8px 0;">
  <li class="checklist-item"><input type="checkbox" class="checklist-checkbox"> <input type="text" class="checklist-input" style="border: none; background: none; padding: 0; font-family: inherit; font-size: inherit; width: calc(100% - 30px);"></li>
</ul>
<p><br></p>`;

  try {
    // Try to insert using execCommand
    const success = document.execCommand('insertHTML', false, checklistHTML);
    
    if (success) {
      // Find the checklist that was just inserted and focus on its input
      const allChecklists = noteentry.querySelectorAll('.checklist');
      if (allChecklists.length > 0) {
        const insertedChecklist = allChecklists[allChecklists.length - 1];
        const input = insertedChecklist.querySelector('.checklist-input');
        
        setTimeout(() => {
          // Focus on the input
          if (input) input.focus();
          
          // Trigger save with 15-second delay (same as regular text editing)
          if (typeof window.markNoteAsModified === 'function') {
            window.markNoteAsModified();
          } else if (typeof window.saveNoteImmediately === 'function') {
            window.saveNoteImmediately();
          } else {
            // Auto-save handles state management automatically
          }
        }, 10);
      }
      
      return;
    }
  } catch (e) {
    console.error('execCommand failed:', e);
  }
  
  // Fallback: manual insertion
  try {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = checklistHTML;
    const checklist = tempDiv.firstChild;
    
    range.insertNode(checklist);
    range.setStartAfter(checklist);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    
    const input = checklist.querySelector('.checklist-input');
    
    setTimeout(() => {
      // Focus on the input of the checklist we just inserted
      if (input) input.focus();
    }, 10);
    
    noteentry.dispatchEvent(new Event('input', { bubbles: true }));
  } catch (e) {
    console.error('Manual insertion failed:', e);
    window.showError('Failed to insert checklist', 'Error');
  }
}

// Export function
window.insertChecklist = insertChecklist;

// Mobile toolbar overflow menu helpers
// (Used by inline onclick handlers generated in index.php)
(function () {
  'use strict';

  let savedMobileToolbarRange = null;

  function captureCurrentSelectionRange(toolbar) {
    try {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const r = sel.getRangeAt(0);
        let container = r.commonAncestorContainer;
        if (container && container.nodeType === 3) container = container.parentNode;

        // Only capture if the selection is inside the same note card.
        if (toolbar) {
          const noteCard = toolbar.closest ? toolbar.closest('.notecard') : null;
          const selectionCard = container && container.closest ? container.closest('.notecard') : null;
          if (noteCard && selectionCard && noteCard !== selectionCard) {
            savedMobileToolbarRange = null;
            return;
          }
        }

        savedMobileToolbarRange = r.cloneRange();
      } else {
        savedMobileToolbarRange = null;
      }
    } catch (e) {
      savedMobileToolbarRange = null;
    }
  }

  function getToolbarRoot(el) {
    return el && el.closest ? el.closest('.note-edit-toolbar') : null;
  }

  function getMenu(toolbar) {
    return toolbar ? toolbar.querySelector('.mobile-toolbar-menu') : null;
  }

  function closeMenu(toolbar) {
    const menu = getMenu(toolbar);
    if (!menu) return;
    menu.hidden = true;
    const toggleBtn = toolbar.querySelector('.mobile-more-btn');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function openMenu(toolbar) {
    const menu = getMenu(toolbar);
    if (!menu) return;
    menu.hidden = false;
    const toggleBtn = toolbar.querySelector('.mobile-more-btn');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  }

  window.toggleMobileToolbarMenu = function (btn) {
    const toolbar = getToolbarRoot(btn);
    if (!toolbar) return;

    // Close any other open menus
    document.querySelectorAll('.note-edit-toolbar .mobile-toolbar-menu:not([hidden])').forEach(m => {
      const root = m.closest('.note-edit-toolbar');
      if (root && root !== toolbar) closeMenu(root);
    });

    const menu = getMenu(toolbar);
    if (!menu) return;
    if (menu.hidden) {
      // Capture selection before the menu steals focus.
      captureCurrentSelectionRange(toolbar);
      openMenu(toolbar);
    } else {
      closeMenu(toolbar);
      savedMobileToolbarRange = null;
    }
  };

  window.triggerMobileToolbarAction = function (menuItemEl, targetSelector) {
    const toolbar = getToolbarRoot(menuItemEl);
    if (!toolbar) return;

    // Preserve selection before closing the menu.
    const rangeToRestore = savedMobileToolbarRange;
    closeMenu(toolbar);
    savedMobileToolbarRange = null;

    // For emoji insertion, restore caret so toggleEmojiPicker/isCursorInEditableNote succeeds.
    if (targetSelector === '.btn-emoji' && rangeToRestore) {
      try {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(rangeToRestore);
        }

        // Also keep a copy for the picker insertion pipeline.
        try {
          window.savedEmojiRange = rangeToRestore.cloneRange();
        } catch (e) {
          window.savedEmojiRange = rangeToRestore;
        }
      } catch (e) {}
    }

    const target = toolbar.querySelector(targetSelector);
    if (target && typeof target.click === 'function') {
      target.click();
    }
  };

  // Global close on outside click + Escape
  document.addEventListener('click', function (e) {
    const openMenus = document.querySelectorAll('.note-edit-toolbar .mobile-toolbar-menu:not([hidden])');
    if (!openMenus.length) return;
    openMenus.forEach(menu => {
      const toolbar = menu.closest('.note-edit-toolbar');
      if (!toolbar) return;
      const toggleBtn = toolbar.querySelector('.mobile-more-btn');
      const clickedInside = menu.contains(e.target) || (toggleBtn && toggleBtn.contains(e.target));
      if (!clickedInside) {
        closeMenu(toolbar);
        savedMobileToolbarRange = null;
      }
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.note-edit-toolbar .mobile-toolbar-menu:not([hidden])').forEach(menu => {
      const toolbar = menu.closest('.note-edit-toolbar');
      if (toolbar) {
        closeMenu(toolbar);
        savedMobileToolbarRange = null;
      }
    });
  });
})();
