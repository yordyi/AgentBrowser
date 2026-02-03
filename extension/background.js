/**
 * Agent Browser - Background Service Worker
 *
 * Handles communication between Native Messaging Host and Content Scripts.
 * Uses a ref-based system (@e1, @e2) for efficient element targeting.
 */

const NATIVE_HOST_NAME = 'com.agent_browser.host';

// Connection state
let nativePort = null;
let isConnected = false;

// Pending requests waiting for responses
const pendingRequests = new Map();
let requestId = 0;

/**
 * Connect to Native Messaging Host
 */
function connectNativeHost() {
  if (nativePort) {
    console.log('[AgentBrowser] Already connected to native host');
    return;
  }

  try {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    isConnected = true;
    console.log('[AgentBrowser] Connected to native host');

    // Handle incoming messages from Native Host
    nativePort.onMessage.addListener(handleNativeMessage);

    // Handle disconnection
    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log('[AgentBrowser] Disconnected from native host:', error?.message || 'unknown reason');
      nativePort = null;
      isConnected = false;

      // Reject all pending requests
      for (const [id, { reject }] of pendingRequests) {
        reject(new Error('Native host disconnected'));
      }
      pendingRequests.clear();
    });
  } catch (error) {
    console.error('[AgentBrowser] Failed to connect to native host:', error);
    isConnected = false;
  }
}

/**
 * Handle messages from Native Host
 */
async function handleNativeMessage(message) {
  console.log('[AgentBrowser] Received from native:', message);

  const { id, action, params, tabId } = message;

  try {
    let result;

    switch (action) {
      case 'snapshot':
        result = await sendToContentScript(tabId, { action: 'snapshot', params });
        break;

      case 'click':
        result = await sendToContentScript(tabId, { action: 'click', params });
        break;

      case 'fill':
        result = await sendToContentScript(tabId, { action: 'fill', params });
        break;

      case 'scroll':
        result = await sendToContentScript(tabId, { action: 'scroll', params });
        break;

      case 'hover':
        result = await sendToContentScript(tabId, { action: 'hover', params });
        break;

      case 'navigate':
        result = await navigateTab(tabId, params.url);
        break;

      case 'getActiveTab':
        result = await getActiveTab();
        break;

      case 'getTabs':
        result = await getAllTabs();
        break;

      case 'ping':
        result = { status: 'pong', timestamp: Date.now() };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Send success response back to native host
    sendToNativeHost({ id, success: true, result });
  } catch (error) {
    // Send error response back to native host
    sendToNativeHost({
      id,
      success: false,
      error: error.message || String(error)
    });
  }
}

/**
 * Send message to Native Host
 */
function sendToNativeHost(message) {
  if (!nativePort) {
    console.error('[AgentBrowser] Cannot send: not connected to native host');
    return;
  }

  console.log('[AgentBrowser] Sending to native:', message);
  nativePort.postMessage(message);
}

/**
 * Send message to Content Script and wait for response
 */
function sendToContentScript(tabId, message) {
  return new Promise(async (resolve, reject) => {
    try {
      // If no tabId specified, get the active tab
      if (!tabId) {
        const activeTab = await getActiveTab();
        tabId = activeTab.id;
      }

      // Ensure content script is injected
      await ensureContentScriptInjected(tabId);

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tabId, message);

      if (response && response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response);
      }
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Ensure content script is injected in the tab
 */
async function ensureContentScriptInjected(tabId) {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
  } catch {
    // Content script not loaded, inject it
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  }
}

/**
 * Get the currently active tab
 */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error('No active tab found');
  }
  return {
    id: tab.id,
    url: tab.url,
    title: tab.title,
    windowId: tab.windowId
  };
}

/**
 * Get all tabs
 */
async function getAllTabs() {
  const tabs = await chrome.tabs.query({});
  return tabs.map(tab => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    windowId: tab.windowId,
    active: tab.active
  }));
}

/**
 * Navigate a tab to a URL
 */
async function navigateTab(tabId, url) {
  if (!tabId) {
    const activeTab = await getActiveTab();
    tabId = activeTab.id;
  }

  await chrome.tabs.update(tabId, { url });

  // Wait for navigation to complete
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ success: true, tabId, url });
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle internal messages from content scripts if needed
  if (message.type === 'contentScriptReady') {
    console.log('[AgentBrowser] Content script ready in tab:', sender.tab?.id);
    sendResponse({ acknowledged: true });
  }
  return true; // Keep channel open for async response
});

// Connect on startup
connectNativeHost();

// Reconnect when the service worker wakes up
chrome.runtime.onStartup.addListener(() => {
  console.log('[AgentBrowser] Extension started');
  connectNativeHost();
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[AgentBrowser] Extension installed/updated:', details.reason);
  connectNativeHost();
});

// Export for potential testing
globalThis.agentBrowser = {
  connect: connectNativeHost,
  isConnected: () => isConnected,
  sendToNativeHost
};
