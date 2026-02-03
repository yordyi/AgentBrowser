/**
 * Agent Browser - Content Script
 *
 * Provides DOM interaction capabilities using the snapshot-browser.js Ref system.
 * Elements are identified using @e1, @e2, etc. format for efficient targeting.
 *
 * Dependencies:
 *   - snapshot-browser.js (loaded before this script via manifest.json)
 */

(function() {
  'use strict';

  // Wait for snapshot module to be available
  const snapshot = window.__agentBrowserSnapshot;
  if (!snapshot) {
    console.error('[AgentBrowser] snapshot-browser.js not loaded');
    return;
  }

  /**
   * Get element by ref (delegates to snapshot module)
   */
  function getElementByRef(ref) {
    // Handle @e1 format
    const cleanRef = ref.startsWith('@') ? ref.slice(1) : ref;
    const element = snapshot.resolveRef(cleanRef);
    if (!element) {
      throw new Error(`Element not found for ref: ${ref}`);
    }
    if (!document.contains(element)) {
      throw new Error(`Element no longer in DOM: ${ref}`);
    }
    return element;
  }

  /**
   * Create a snapshot using the full Ref system
   */
  function createSnapshot(options = {}) {
    const { interactive, maxDepth, compact, selector } = options;

    const result = snapshot.buildSnapshot(document.body, {
      interactive: interactive ?? true,
      maxDepth: maxDepth ?? undefined,
      compact: compact ?? false,
      selector: selector ?? undefined
    });

    // Add page metadata
    return {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      tree: result.tree,
      refs: result.refs,
      stats: snapshot.getSnapshotStats(result.tree, result.refs)
    };
  }

  /**
   * Click an element by ref
   */
  function clickElement(ref) {
    const element = getElementByRef(ref);

    // Scroll element into view
    element.scrollIntoView({ behavior: 'instant', block: 'center' });

    // Focus the element
    if (element.focus) {
      element.focus();
    }

    // Dispatch click event
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;

    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y
    });

    element.dispatchEvent(clickEvent);

    return {
      success: true,
      ref,
      clicked: {
        role: snapshot.getRole(element),
        name: snapshot.getAccessibleName(element)
      }
    };
  }

  /**
   * Fill a form element by ref
   */
  function fillElement(ref, value) {
    const element = getElementByRef(ref);

    // Scroll into view
    element.scrollIntoView({ behavior: 'instant', block: 'center' });

    // Focus
    if (element.focus) {
      element.focus();
    }

    // Handle different input types
    if (element.tagName === 'SELECT') {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.type === 'checkbox' || element.type === 'radio') {
      const shouldCheck = value === true || value === 'true' || value === 1;
      if (element.checked !== shouldCheck) {
        element.click();
      }
    } else if (element.contentEditable === 'true') {
      element.textContent = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // Text input, textarea, etc.
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));

      // Type the value character by character for better compatibility
      for (const char of value) {
        element.value += char;
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      }

      element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return {
      success: true,
      ref,
      filled: {
        role: snapshot.getRole(element),
        name: snapshot.getAccessibleName(element),
        value: value
      }
    };
  }

  /**
   * Scroll the page or an element
   */
  function scrollPage(direction, amount = 300, ref = null) {
    if (ref) {
      const element = getElementByRef(ref);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { success: true, scrolledTo: ref };
    }

    const scrollMap = {
      up: { x: 0, y: -amount },
      down: { x: 0, y: amount },
      left: { x: -amount, y: 0 },
      right: { x: amount, y: 0 }
    };

    const scroll = scrollMap[direction] || { x: 0, y: amount };
    window.scrollBy({ left: scroll.x, top: scroll.y, behavior: 'smooth' });

    return {
      success: true,
      direction,
      scrollPosition: {
        x: window.scrollX,
        y: window.scrollY
      }
    };
  }

  /**
   * Hover over an element
   */
  function hoverElement(ref) {
    const element = getElementByRef(ref);

    element.scrollIntoView({ behavior: 'instant', block: 'center' });

    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;

    const mouseEnterEvent = new MouseEvent('mouseenter', {
      view: window,
      bubbles: true,
      clientX: x,
      clientY: y
    });

    const mouseOverEvent = new MouseEvent('mouseover', {
      view: window,
      bubbles: true,
      clientX: x,
      clientY: y
    });

    element.dispatchEvent(mouseEnterEvent);
    element.dispatchEvent(mouseOverEvent);

    return {
      success: true,
      ref,
      hovered: {
        role: snapshot.getRole(element),
        name: snapshot.getAccessibleName(element)
      }
    };
  }

  // Expose API on window object
  window.__agentBrowser = {
    snapshot: createSnapshot,
    click: clickElement,
    fill: fillElement,
    scroll: scrollPage,
    hover: hoverElement,
    getElementByRef,
    // Expose snapshot module utilities
    getRole: snapshot.getRole,
    getAccessibleName: snapshot.getAccessibleName,
    resolveRef: snapshot.resolveRef,
    version: '1.0.0'
  };

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { action, params = {} } = message;

    try {
      let result;

      switch (action) {
        case 'ping':
          result = { status: 'pong', url: window.location.href };
          break;

        case 'snapshot':
          result = createSnapshot(params);
          break;

        case 'click':
          result = clickElement(params.ref);
          break;

        case 'fill':
          result = fillElement(params.ref, params.value);
          break;

        case 'scroll':
          result = scrollPage(params.direction, params.amount, params.ref);
          break;

        case 'hover':
          result = hoverElement(params.ref);
          break;

        default:
          throw new Error(`Unknown action: ${action}`);
      }

      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }

    return true; // Keep channel open for async response
  });

  // Notify background script that content script is ready
  chrome.runtime.sendMessage({ type: 'contentScriptReady' }).catch(() => {
    // Ignore errors if background is not ready yet
  });

  console.log('[AgentBrowser] Content script loaded with snapshot module');
})();
