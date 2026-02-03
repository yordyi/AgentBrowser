/**
 * Agent Browser V2 - Content Script
 *
 * 处理页面操作：快照、点击、填充、滚动等
 */

// ============================================================
// 元素引用系统 (Ref)
// ============================================================

const elementMap = new Map(); // ref -> element
let refCounter = 0;

function getRef(element) {
  for (const [ref, el] of elementMap) {
    if (el === element) return ref;
  }
  const ref = `e${++refCounter}`;
  elementMap.set(ref, element);
  return ref;
}

function getElement(ref) {
  return elementMap.get(ref);
}

// ============================================================
// 快照
// ============================================================

function snapshot() {
  const elements = [];

  const interestingTags = [
    'a', 'button', 'input', 'select', 'textarea',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'span', 'div', 'li', 'td', 'th',
    'img', 'video', 'audio', 'iframe',
    'form', 'label'
  ];

  const allElements = document.querySelectorAll(interestingTags.join(','));

  for (const el of allElements) {
    // 跳过不可见元素
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    // 获取基本信息
    const ref = getRef(el);
    const tag = el.tagName.toLowerCase();
    const text = el.innerText?.substring(0, 100)?.trim() || '';
    const role = el.getAttribute('role') || '';
    const ariaLabel = el.getAttribute('aria-label') || '';

    const info = {
      ref,
      tag,
      text: text.substring(0, 50),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    };

    // 添加额外属性
    if (el.id) info.id = el.id;
    if (el.className && typeof el.className === 'string') {
      info.class = el.className.substring(0, 50);
    }
    if (role) info.role = role;
    if (ariaLabel) info.ariaLabel = ariaLabel;
    if (el.href) info.href = el.href;
    if (el.src) info.src = el.src;
    if (el.type) info.type = el.type;
    if (el.name) info.name = el.name;
    if (el.value) info.value = el.value.substring(0, 50);
    if (el.placeholder) info.placeholder = el.placeholder;

    elements.push(info);
  }

  return {
    url: location.href,
    title: document.title,
    elements,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    }
  };
}

// ============================================================
// 元素操作
// ============================================================

function findElement(params) {
  // 优先使用 ref
  if (params.ref) {
    const el = getElement(params.ref);
    if (el) return el;
  }

  // 使用选择器
  if (params.selector) {
    return document.querySelector(params.selector);
  }

  // 使用文本
  if (params.text) {
    const xpath = `//*[contains(text(), "${params.text}")]`;
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    return result.singleNodeValue;
  }

  throw new Error('No element identifier provided');
}

function click(params) {
  const el = findElement(params);
  if (!el) throw new Error('Element not found');

  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  el.click();

  return { clicked: true };
}

function fill(params) {
  const el = findElement(params);
  if (!el) throw new Error('Element not found');

  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  el.focus();
  el.value = params.value || '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return { filled: true };
}

function typeText(params) {
  const el = findElement(params);
  if (!el) throw new Error('Element not found');

  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  el.focus();

  const text = params.text || '';
  for (const char of text) {
    el.value += char;
    el.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
  }

  return { typed: true };
}

function scroll(params) {
  const { direction, amount } = params;
  const pixels = amount || 300;

  switch (direction) {
    case 'up':
      window.scrollBy(0, -pixels);
      break;
    case 'down':
      window.scrollBy(0, pixels);
      break;
    case 'left':
      window.scrollBy(-pixels, 0);
      break;
    case 'right':
      window.scrollBy(pixels, 0);
      break;
    default:
      if (params.x !== undefined || params.y !== undefined) {
        window.scrollTo(params.x || 0, params.y || 0);
      }
  }

  return {
    scrollX: window.scrollX,
    scrollY: window.scrollY
  };
}

function hover(params) {
  const el = findElement(params);
  if (!el) throw new Error('Element not found');

  el.scrollIntoView({ behavior: 'instant', block: 'center' });
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

  return { hovered: true };
}

function press(params) {
  const key = params.key;
  const target = document.activeElement || document.body;

  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true
  });

  target.dispatchEvent(event);
  target.dispatchEvent(new KeyboardEvent('keyup', { key, code: key, bubbles: true }));

  return { pressed: key };
}

function wait(params) {
  return new Promise((resolve) => {
    const timeout = params.timeout || 1000;

    if (params.selector) {
      // 等待元素出现
      const startTime = Date.now();
      const check = () => {
        if (document.querySelector(params.selector)) {
          resolve({ found: true });
        } else if (Date.now() - startTime > timeout) {
          resolve({ found: false, timeout: true });
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    } else {
      // 简单等待
      setTimeout(() => resolve({ waited: timeout }), timeout);
    }
  });
}

function evaluate(params) {
  const code = params.code || params.expression;
  if (!code) throw new Error('No code provided');

  const result = Function(`"use strict"; return (${code})`)();

  return { result: JSON.stringify(result) };
}

// ============================================================
// 消息处理
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, params } = message;

  if (action === 'ping') {
    sendResponse({ pong: true });
    return;
  }

  try {
    let result;

    switch (action) {
      case 'snapshot':
        result = snapshot();
        break;
      case 'click':
        result = click(params);
        break;
      case 'fill':
        result = fill(params);
        break;
      case 'type':
        result = typeText(params);
        break;
      case 'scroll':
        result = scroll(params);
        break;
      case 'hover':
        result = hover(params);
        break;
      case 'press':
        result = press(params);
        break;
      case 'wait':
        wait(params).then(r => sendResponse({ result: r }));
        return true; // 异步响应
      case 'evaluate':
        result = evaluate(params);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    sendResponse({ result });
  } catch (e) {
    sendResponse({ error: e.message });
  }
});

console.log('[V2] Content script loaded');
