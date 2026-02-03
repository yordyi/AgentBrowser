/**
 * Agent Browser V2 - Background Service Worker
 *
 * 处理来自 Native Host 的命令，执行页面操作
 */

const HOST_NAME = 'com.agent_browser.host';

let port = null;

// ============================================================
// Native Messaging 连接
// ============================================================

function connect() {
  console.log('[V2] Connecting to Native Host...');

  try {
    port = chrome.runtime.connectNative(HOST_NAME);
    console.log('[V2] Port created');

    port.onMessage.addListener(handleMessage);

    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError;
      console.error('[V2] Disconnected:', err?.message || 'unknown');
      port = null;
      setTimeout(connect, 5000);
    });

    console.log('[V2] Listeners attached');
  } catch (e) {
    console.error('[V2] Connect error:', e);
  }
}

function send(obj) {
  if (!port) {
    console.error('[V2] Not connected');
    return;
  }
  console.log('[V2] Sending:', obj);
  port.postMessage(obj);
}

// ============================================================
// 命令处理
// ============================================================

async function handleMessage(msg) {
  console.log('[V2] Received:', msg);

  const { id, type } = msg;

  // ready 消息
  if (type === 'ready') {
    console.log('[V2] Host ready, socket:', msg.socketPath);
    return;
  }

  if (!id) {
    console.error('[V2] Message missing id');
    return;
  }

  try {
    let result;

    switch (type) {
      // 页面快照
      case 'snapshot':
        result = await executeInTab('snapshot', msg);
        break;

      // 点击
      case 'click':
        result = await executeInTab('click', msg);
        break;

      // 填充
      case 'fill':
        result = await executeInTab('fill', msg);
        break;

      // 输入
      case 'type':
        result = await executeInTab('type', msg);
        break;

      // 滚动
      case 'scroll':
        result = await executeInTab('scroll', msg);
        break;

      // 悬停
      case 'hover':
        result = await executeInTab('hover', msg);
        break;

      // 按键
      case 'press':
        result = await executeInTab('press', msg);
        break;

      // 等待
      case 'wait':
        result = await executeInTab('wait', msg);
        break;

      // 执行 JS
      case 'evaluate':
        result = await executeInTab('evaluate', msg);
        break;

      // 导航
      case 'navigate':
        result = await navigate(msg.url);
        break;

      // 后退
      case 'back':
        result = await goBack();
        break;

      // 前进
      case 'forward':
        result = await goForward();
        break;

      // 刷新
      case 'reload':
        result = await reload();
        break;

      // 截图
      case 'screenshot':
        result = await screenshot(msg);
        break;

      // 标签页列表
      case 'tabList':
        result = await listTabs();
        break;

      // 新建标签页
      case 'tabNew':
        result = await newTab(msg.url);
        break;

      // 切换标签页
      case 'tabSwitch':
        result = await switchTab(msg.tabId || msg.index);
        break;

      // 关闭标签页
      case 'tabClose':
        result = await closeTab(msg.tabId || msg.index);
        break;

      // 获取 URL
      case 'getUrl':
        result = await getUrl();
        break;

      // 获取标题
      case 'getTitle':
        result = await getTitle();
        break;

      default:
        throw new Error(`Unknown type: ${type}`);
    }

    // 确保请求 id 不被 result 中的属性覆盖
    send({ ...result, id, success: true });
  } catch (e) {
    console.error('[V2] Error:', e);
    send({ id, error: e.message });
  }
}

// ============================================================
// 页面操作 (通过 Content Script)
// ============================================================

// 记录最近操作的 tabId
let lastUsedTabId = null;

async function getActiveTab() {
  // 方案1: 尝试 lastFocusedWindow
  let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  // 方案2: 如果失败，尝试任何窗口的活动标签
  if (!tab) {
    const tabs = await chrome.tabs.query({ active: true });
    // 优先选择非 chrome:// 页面
    tab = tabs.find(t => !t.url?.startsWith('chrome://')) || tabs[0];
  }

  // 方案3: 使用上次操作的标签
  if (!tab && lastUsedTabId) {
    try {
      tab = await chrome.tabs.get(lastUsedTabId);
    } catch {}
  }

  if (!tab) throw new Error('No active tab');

  lastUsedTabId = tab.id;
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await new Promise(r => setTimeout(r, 100));
  }
}

async function executeInTab(action, params) {
  const tab = await getActiveTab();

  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    throw new Error(`Cannot execute on: ${tab.url}`);
  }

  await ensureContentScript(tab.id);

  const response = await chrome.tabs.sendMessage(tab.id, { action, params });

  if (response?.error) {
    throw new Error(response.error);
  }

  return response?.result || response || {};
}

// ============================================================
// 导航操作
// ============================================================

async function navigate(url) {
  const tab = await getActiveTab();
  await chrome.tabs.update(tab.id, { url });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve({ url, timeout: true });
    }, 30000);

    const listener = (tabId, changeInfo, updatedTab) => {
      if (tabId === tab.id && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ url: updatedTab.url, title: updatedTab.title });
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function goBack() {
  const tab = await getActiveTab();
  await chrome.tabs.goBack(tab.id);
  return {};
}

async function goForward() {
  const tab = await getActiveTab();
  await chrome.tabs.goForward(tab.id);
  return {};
}

async function reload() {
  const tab = await getActiveTab();
  await chrome.tabs.reload(tab.id);
  return {};
}

// ============================================================
// 截图
// ============================================================

async function screenshot(params) {
  const format = params.format || 'png';
  const options = { format };
  if (format === 'jpeg' && params.quality) {
    options.quality = params.quality;
  }
  const dataUrl = await chrome.tabs.captureVisibleTab(null, options);
  return { screenshot: dataUrl };
}

// ============================================================
// 标签页操作
// ============================================================

async function listTabs() {
  const tabs = await chrome.tabs.query({});
  return {
    tabs: tabs.map((t, i) => ({
      index: i,
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.active
    }))
  };
}

async function newTab(url) {
  const tab = await chrome.tabs.create({ url: url || 'about:blank' });
  lastUsedTabId = tab.id;  // 记录新创建的标签
  return { tabId: tab.id, url: tab.url, title: tab.title };
}

async function switchTab(idOrIndex) {
  if (typeof idOrIndex === 'number' && idOrIndex < 1000) {
    // 是 index
    const tabs = await chrome.tabs.query({});
    if (idOrIndex < 0 || idOrIndex >= tabs.length) {
      throw new Error(`Invalid index: ${idOrIndex}`);
    }
    await chrome.tabs.update(tabs[idOrIndex].id, { active: true });
    lastUsedTabId = tabs[idOrIndex].id;  // 记录
    return { tabId: tabs[idOrIndex].id };
  } else {
    // 是 tabId
    await chrome.tabs.update(idOrIndex, { active: true });
    lastUsedTabId = idOrIndex;  // 记录
    return { tabId: idOrIndex };
  }
}

async function closeTab(idOrIndex) {
  if (idOrIndex === undefined) {
    const tab = await getActiveTab();
    await chrome.tabs.remove(tab.id);
    return { closedId: tab.id };
  }

  if (typeof idOrIndex === 'number' && idOrIndex < 1000) {
    const tabs = await chrome.tabs.query({});
    if (idOrIndex < 0 || idOrIndex >= tabs.length) {
      throw new Error(`Invalid index: ${idOrIndex}`);
    }
    await chrome.tabs.remove(tabs[idOrIndex].id);
    return { closedId: tabs[idOrIndex].id };
  } else {
    await chrome.tabs.remove(idOrIndex);
    return { closedId: idOrIndex };
  }
}

async function getUrl() {
  const tab = await getActiveTab();
  return { url: tab.url };
}

async function getTitle() {
  const tab = await getActiveTab();
  return { title: tab.title };
}

// ============================================================
// 启动
// ============================================================

connect();
console.log('[V2] Service Worker loaded');
