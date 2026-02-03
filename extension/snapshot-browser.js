/**
 * Browser-native snapshot implementation for Chrome extensions.
 *
 * This is a port of the Playwright-based snapshot.ts to pure DOM APIs,
 * enabling accessibility snapshots in Chrome extension environments.
 *
 * Example output:
 *   - heading "Example Domain" [ref=e1] [level=1]
 *   - paragraph: Some text content
 *   - button "Submit" [ref=e2]
 *   - textbox "Email" [ref=e3]
 *
 * Usage:
 *   const { tree, refs } = window.__agentBrowserSnapshot.buildSnapshot();
 *   const element = window.__agentBrowserSnapshot.resolveRef('e1');
 */

(function () {
  'use strict';

  // ============================================================
  // Role Constants
  // ============================================================

  /**
   * Roles that are interactive and should get refs
   */
  const INTERACTIVE_ROLES = new Set([
    'button',
    'link',
    'textbox',
    'checkbox',
    'radio',
    'combobox',
    'listbox',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'treeitem',
  ]);

  /**
   * Roles that provide structure/context (get refs for text extraction)
   */
  const CONTENT_ROLES = new Set([
    'heading',
    'cell',
    'gridcell',
    'columnheader',
    'rowheader',
    'listitem',
    'article',
    'region',
    'main',
    'navigation',
  ]);

  /**
   * Roles that are purely structural (can be filtered in compact mode)
   */
  const STRUCTURAL_ROLES = new Set([
    'generic',
    'group',
    'list',
    'table',
    'row',
    'rowgroup',
    'grid',
    'treegrid',
    'menu',
    'menubar',
    'toolbar',
    'tablist',
    'tree',
    'directory',
    'document',
    'application',
    'presentation',
    'none',
  ]);

  // ============================================================
  // State
  // ============================================================

  let refCounter = 0;
  /** @type {Map<string, Element>} */
  const refMap = new Map();

  /**
   * Reset ref counter and map (call at start of each snapshot)
   */
  function resetRefs() {
    refCounter = 0;
    refMap.clear();
  }

  /**
   * Generate next ref ID
   * @returns {string}
   */
  function nextRef() {
    return `e${++refCounter}`;
  }

  // ============================================================
  // Role Name Tracking (for duplicate detection)
  // ============================================================

  /**
   * @typedef {Object} RoleNameTracker
   * @property {Map<string, number>} counts
   * @property {Map<string, string[]>} refsByKey
   * @property {function(string, string=): string} getKey
   * @property {function(string, string=): number} getNextIndex
   * @property {function(string, string|undefined, string): void} trackRef
   * @property {function(): Set<string>} getDuplicateKeys
   */

  /**
   * Create a tracker for role+name combinations to detect duplicates
   * @returns {RoleNameTracker}
   */
  function createRoleNameTracker() {
    const counts = new Map();
    const refsByKey = new Map();

    return {
      counts,
      refsByKey,
      getKey(role, name) {
        return `${role}:${name ?? ''}`;
      },
      getNextIndex(role, name) {
        const key = this.getKey(role, name);
        const current = counts.get(key) ?? 0;
        counts.set(key, current + 1);
        return current;
      },
      trackRef(role, name, ref) {
        const key = this.getKey(role, name);
        const refs = refsByKey.get(key) ?? [];
        refs.push(ref);
        refsByKey.set(key, refs);
      },
      getDuplicateKeys() {
        const duplicates = new Set();
        for (const [key, refs] of refsByKey) {
          if (refs.length > 1) {
            duplicates.add(key);
          }
        }
        return duplicates;
      },
    };
  }

  // ============================================================
  // Role Detection
  // ============================================================

  /**
   * Mapping of input types to ARIA roles
   */
  const INPUT_TYPE_ROLES = {
    text: 'textbox',
    email: 'textbox',
    password: 'textbox',
    search: 'searchbox',
    tel: 'textbox',
    url: 'textbox',
    checkbox: 'checkbox',
    radio: 'radio',
    button: 'button',
    submit: 'button',
    reset: 'button',
    image: 'button',
    range: 'slider',
    number: 'spinbutton',
    hidden: null, // Not rendered
    file: 'button', // Treated as button
  };

  /**
   * Mapping of tag names to implicit ARIA roles
   */
  const TAG_ROLES = {
    BUTTON: 'button',
    A: 'link',
    SELECT: 'combobox',
    TEXTAREA: 'textbox',
    H1: 'heading',
    H2: 'heading',
    H3: 'heading',
    H4: 'heading',
    H5: 'heading',
    H6: 'heading',
    LI: 'listitem',
    TD: 'cell',
    TH: 'columnheader',
    TR: 'row',
    THEAD: 'rowgroup',
    TBODY: 'rowgroup',
    TFOOT: 'rowgroup',
    TABLE: 'table',
    UL: 'list',
    OL: 'list',
    NAV: 'navigation',
    MAIN: 'main',
    HEADER: 'banner',
    FOOTER: 'contentinfo',
    ASIDE: 'complementary',
    ARTICLE: 'article',
    SECTION: 'region',
    FORM: 'form',
    IMG: 'img',
    FIGURE: 'figure',
    FIGCAPTION: 'caption',
    DETAILS: 'group',
    SUMMARY: 'button',
    DIALOG: 'dialog',
    MENU: 'menu',
    OPTION: 'option',
    OPTGROUP: 'group',
    FIELDSET: 'group',
    LEGEND: 'legend',
    OUTPUT: 'status',
    PROGRESS: 'progressbar',
    METER: 'meter',
  };

  /**
   * Get the ARIA role for an input element
   * @param {HTMLInputElement} input
   * @returns {string|null}
   */
  function getInputRole(input) {
    const type = (input.type || 'text').toLowerCase();
    return INPUT_TYPE_ROLES[type] ?? 'textbox';
  }

  /**
   * Get the ARIA role for an element
   * @param {Element} element
   * @returns {string}
   */
  function getRole(element) {
    // 1. Explicit role attribute takes precedence
    const explicitRole = element.getAttribute('role');
    if (explicitRole) {
      return explicitRole.toLowerCase();
    }

    // 2. Handle input elements specially
    if (element.tagName === 'INPUT') {
      const role = getInputRole(/** @type {HTMLInputElement} */ (element));
      return role ?? 'generic';
    }

    // 3. Handle anchor elements - only links if they have href
    if (element.tagName === 'A') {
      return element.hasAttribute('href') ? 'link' : 'generic';
    }

    // 4. Implicit role based on tag name
    return TAG_ROLES[element.tagName] ?? 'generic';
  }

  // ============================================================
  // Accessible Name Computation
  // ============================================================

  /**
   * Get the accessible name for an element
   * Simplified implementation of the accessible name computation algorithm
   * @param {Element} element
   * @returns {string}
   */
  function getAccessibleName(element) {
    // 1. aria-labelledby (highest priority)
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const names = labelledBy
        .split(/\s+/)
        .map((id) => {
          const labelElement = document.getElementById(id);
          return labelElement ? getTextContent(labelElement) : '';
        })
        .filter(Boolean);
      if (names.length > 0) {
        return names.join(' ');
      }
    }

    // 2. aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    // 3. For inputs, check associated label
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
      const input = /** @type {HTMLInputElement} */ (element);

      // Check for label with for attribute
      if (input.id) {
        const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) {
          return getTextContent(label);
        }
      }

      // Check for wrapping label
      const parentLabel = element.closest('label');
      if (parentLabel) {
        // Get label text excluding the input itself
        const clone = /** @type {HTMLElement} */ (parentLabel.cloneNode(true));
        const inputs = clone.querySelectorAll('input, textarea, select');
        inputs.forEach((i) => i.remove());
        const labelText = clone.textContent?.trim();
        if (labelText) {
          return labelText;
        }
      }

      // Placeholder as fallback
      if (input.placeholder) {
        return input.placeholder;
      }
    }

    // 4. For images, use alt text
    if (element.tagName === 'IMG') {
      const alt = element.getAttribute('alt');
      if (alt !== null) {
        return alt;
      }
    }

    // 5. title attribute
    const title = element.getAttribute('title');
    if (title) {
      return title;
    }

    // 6. For buttons and links, use text content
    const role = getRole(element);
    if (role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem') {
      return getTextContent(element);
    }

    // 7. For headings and other content roles, use text content
    if (CONTENT_ROLES.has(role)) {
      return getTextContent(element);
    }

    return '';
  }

  /**
   * Get text content, limiting length
   * @param {Element} element
   * @param {number} [maxLength=100]
   * @returns {string}
   */
  function getTextContent(element, maxLength = 100) {
    const text = element.textContent?.trim() ?? '';
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text;
  }

  // ============================================================
  // Visibility Detection
  // ============================================================

  /**
   * Check if an element is visible
   * @param {Element} element
   * @returns {boolean}
   */
  function isVisible(element) {
    // Quick check for common hidden patterns
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'NOSCRIPT') {
      return false;
    }

    // Check aria-hidden
    if (element.getAttribute('aria-hidden') === 'true') {
      return false;
    }

    // Check hidden attribute
    if (element.hasAttribute('hidden')) {
      return false;
    }

    // Check display and visibility via computed style
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    // Check for zero dimensions (but allow elements with overflow content)
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      // Elements with overflow:hidden children might still have content
      if (!element.children.length) {
        return false;
      }
    }

    return true;
  }

  // ============================================================
  // Snapshot Building
  // ============================================================

  /**
   * @typedef {Object} RefData
   * @property {string} selector - Playwright-style selector
   * @property {string} role - ARIA role
   * @property {string} [name] - Accessible name
   * @property {number} [nth] - Index for disambiguation
   */

  /**
   * @typedef {Object.<string, RefData>} RefMapData
   */

  /**
   * @typedef {Object} SnapshotOptions
   * @property {boolean} [interactive] - Only include interactive elements
   * @property {number} [maxDepth] - Maximum depth of tree
   * @property {boolean} [compact] - Remove structural elements without content
   * @property {string} [selector] - CSS selector to scope the snapshot
   */

  /**
   * @typedef {Object} EnhancedSnapshot
   * @property {string} tree - The formatted accessibility tree
   * @property {RefMapData} refs - Map of refs to element data
   */

  /**
   * Build a Playwright-style selector string
   * @param {string} role
   * @param {string} [name]
   * @returns {string}
   */
  function buildSelector(role, name) {
    if (name) {
      const escapedName = name.replace(/"/g, '\\"');
      return `getByRole('${role}', { name: "${escapedName}", exact: true })`;
    }
    return `getByRole('${role}')`;
  }

  /**
   * Get additional attributes for a role (e.g., heading level)
   * @param {Element} element
   * @param {string} role
   * @returns {string}
   */
  function getExtraAttributes(element, role) {
    let attrs = '';

    // Heading level
    if (role === 'heading') {
      const match = element.tagName.match(/H(\d)/);
      if (match) {
        attrs += ` [level=${match[1]}]`;
      } else {
        const ariaLevel = element.getAttribute('aria-level');
        if (ariaLevel) {
          attrs += ` [level=${ariaLevel}]`;
        }
      }
    }

    // Checkbox/switch checked state
    if (role === 'checkbox' || role === 'switch' || role === 'radio') {
      const checked = element.getAttribute('aria-checked') ?? (/** @type {HTMLInputElement} */ (element).checked ? 'true' : 'false');
      if (checked === 'true') {
        attrs += ' [checked]';
      } else if (checked === 'mixed') {
        attrs += ' [checked=mixed]';
      }
    }

    // Expanded state
    const expanded = element.getAttribute('aria-expanded');
    if (expanded !== null) {
      attrs += ` [expanded=${expanded}]`;
    }

    // Selected state (for tabs, options)
    if (role === 'tab' || role === 'option' || role === 'treeitem') {
      const selected = element.getAttribute('aria-selected');
      if (selected === 'true') {
        attrs += ' [selected]';
      }
    }

    // Disabled state
    if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') {
      attrs += ' [disabled]';
    }

    // Required state
    if (element.hasAttribute('required') || element.getAttribute('aria-required') === 'true') {
      attrs += ' [required]';
    }

    return attrs;
  }

  /**
   * Build the accessibility snapshot
   * @param {Element} [root=document.body]
   * @param {SnapshotOptions} [options={}]
   * @returns {EnhancedSnapshot}
   */
  function buildSnapshot(root = document.body, options = {}) {
    resetRefs();
    const tracker = createRoleNameTracker();
    /** @type {RefMapData} */
    const refs = {};
    /** @type {string[]} */
    const lines = [];

    // Handle selector option
    if (options.selector) {
      const scopedRoot = document.querySelector(options.selector);
      if (scopedRoot) {
        root = scopedRoot;
      }
    }

    /**
     * Process a single element and its children
     * @param {Element} node
     * @param {number} depth
     */
    function processNode(node, depth) {
      // Skip non-element nodes
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      // Check visibility
      if (!isVisible(node)) {
        return;
      }

      // Check max depth
      if (options.maxDepth !== undefined && depth > options.maxDepth) {
        return;
      }

      const role = getRole(node);
      const name = getAccessibleName(node);
      const isInteractive = INTERACTIVE_ROLES.has(role);
      const isContent = CONTENT_ROLES.has(role);
      const isStructural = STRUCTURAL_ROLES.has(role);

      // In interactive-only mode, skip non-interactive elements but still process children
      if (options.interactive && !isInteractive) {
        for (const child of node.children) {
          processNode(child, depth);
        }
        return;
      }

      // In compact mode, skip unnamed structural elements but still process children
      if (options.compact && isStructural && !name) {
        for (const child of node.children) {
          processNode(child, depth);
        }
        return;
      }

      // Build the line
      const indent = '  '.repeat(depth);
      let line = `${indent}- ${role}`;

      if (name) {
        line += ` "${name}"`;
      }

      // Add ref for interactive or named content elements
      const shouldHaveRef = isInteractive || (isContent && name);

      if (shouldHaveRef) {
        const ref = nextRef();
        const nth = tracker.getNextIndex(role, name);
        tracker.trackRef(role, name, ref);

        // Store in refs object
        refs[ref] = {
          selector: buildSelector(role, name),
          role,
          name: name || undefined,
          nth,
        };

        // Store in refMap for element lookup
        refMap.set(ref, node);

        line += ` [ref=${ref}]`;

        // Only show nth in output if it's > 0 (for readability)
        if (nth > 0) {
          line += ` [nth=${nth}]`;
        }
      }

      // Add extra attributes
      line += getExtraAttributes(node, role);

      lines.push(line);

      // Process children
      for (const child of node.children) {
        processNode(child, depth + 1);
      }
    }

    // Start processing from root
    processNode(root, 0);

    // Post-process: remove nth from refs that don't have duplicates
    const duplicateKeys = tracker.getDuplicateKeys();
    for (const [ref, data] of Object.entries(refs)) {
      const key = tracker.getKey(data.role, data.name);
      if (!duplicateKeys.has(key)) {
        delete refs[ref].nth;
      }
    }

    // Handle empty result
    if (lines.length === 0) {
      return {
        tree: options.interactive ? '(no interactive elements)' : '(empty)',
        refs: {},
      };
    }

    // Compact mode post-processing
    let tree = lines.join('\n');
    if (options.compact) {
      tree = compactTree(tree);
    }

    return { tree, refs };
  }

  /**
   * Get indentation level from a line
   * @param {string} line
   * @returns {number}
   */
  function getIndentLevel(line) {
    const match = line.match(/^(\s*)/);
    return match ? Math.floor(match[1].length / 2) : 0;
  }

  /**
   * Remove empty structural branches in compact mode
   * @param {string} tree
   * @returns {string}
   */
  function compactTree(tree) {
    const lines = tree.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Always keep lines with refs
      if (line.includes('[ref=')) {
        result.push(line);
        continue;
      }

      // Keep lines with text content (after :)
      if (line.includes(':') && !line.endsWith(':')) {
        result.push(line);
        continue;
      }

      // Check if this structural element has children with refs
      const currentIndent = getIndentLevel(line);
      let hasRelevantChildren = false;

      for (let j = i + 1; j < lines.length; j++) {
        const childIndent = getIndentLevel(lines[j]);
        if (childIndent <= currentIndent) break;
        if (lines[j].includes('[ref=')) {
          hasRelevantChildren = true;
          break;
        }
      }

      if (hasRelevantChildren) {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  // ============================================================
  // Element Resolution
  // ============================================================

  /**
   * Resolve a ref to its DOM element
   * @param {string} ref
   * @returns {Element|null}
   */
  function resolveRef(ref) {
    return refMap.get(ref) ?? null;
  }

  /**
   * Parse a ref from command argument (e.g., "@e1" -> "e1")
   * @param {string} arg
   * @returns {string|null}
   */
  function parseRef(arg) {
    if (arg.startsWith('@')) {
      return arg.slice(1);
    }
    if (arg.startsWith('ref=')) {
      return arg.slice(4);
    }
    if (/^e\d+$/.test(arg)) {
      return arg;
    }
    return null;
  }

  // ============================================================
  // Statistics
  // ============================================================

  /**
   * Get snapshot statistics
   * @param {string} tree
   * @param {RefMapData} refs
   * @returns {{lines: number, chars: number, tokens: number, refs: number, interactive: number}}
   */
  function getSnapshotStats(tree, refs) {
    const interactive = Object.values(refs).filter((r) => INTERACTIVE_ROLES.has(r.role)).length;

    return {
      lines: tree.split('\n').length,
      chars: tree.length,
      tokens: Math.ceil(tree.length / 4),
      refs: Object.keys(refs).length,
      interactive,
    };
  }

  // ============================================================
  // Export API
  // ============================================================

  window.__agentBrowserSnapshot = {
    // Main API
    buildSnapshot,
    resolveRef,
    parseRef,
    getSnapshotStats,

    // Utilities
    getRole,
    getAccessibleName,
    isVisible,

    // Constants (for debugging/testing)
    INTERACTIVE_ROLES,
    CONTENT_ROLES,
    STRUCTURAL_ROLES,

    // Internal state access (for debugging)
    getRefMap: () => Object.fromEntries(refMap),
    resetRefs,
  };
})();
