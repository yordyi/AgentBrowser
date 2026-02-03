/**
 * Agent Browser - Popup Script
 *
 * Handles the extension popup UI and user interactions.
 */

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const tabTitle = document.getElementById('tabTitle');
const tabId = document.getElementById('tabId');
const elementCount = document.getElementById('elementCount');
const lastSnapshot = document.getElementById('lastSnapshot');
const snapshotBtn = document.getElementById('snapshotBtn');
const reconnectBtn = document.getElementById('reconnectBtn');

/**
 * Update connection status in UI
 */
function updateStatus(connected, message) {
  if (connected) {
    statusIndicator.classList.add('connected');
    statusText.textContent = message || 'Connected to Native Host';
  } else {
    statusIndicator.classList.remove('connected');
    statusText.textContent = message || 'Not connected';
  }
}

/**
 * Update current tab info
 */
async function updateTabInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      tabTitle.textContent = truncate(tab.title || 'Untitled', 25);
      tabTitle.title = tab.title;
      tabId.textContent = tab.id;
    }
  } catch (error) {
    console.error('Failed to get tab info:', error);
    tabTitle.textContent = 'Error';
    tabId.textContent = '-';
  }
}

/**
 * Check if native host is connected
 */
async function checkConnection() {
  try {
    // Try to communicate with background script
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    updateStatus(response?.connected ?? false);
  } catch (error) {
    updateStatus(false, 'Extension error');
  }
}

/**
 * Take a snapshot of the current page
 */
async function takeSnapshot() {
  snapshotBtn.disabled = true;
  snapshotBtn.textContent = 'Taking snapshot...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      throw new Error('No active tab');
    }

    // Send message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'snapshot' });

    if (response?.success && response.result) {
      const count = response.result.elements?.length || 0;
      elementCount.textContent = count;
      lastSnapshot.textContent = formatTime(new Date());

      // Log snapshot to console for debugging
      console.log('Snapshot result:', response.result);

      snapshotBtn.textContent = `Found ${count} elements`;
      setTimeout(() => {
        snapshotBtn.textContent = 'Take Snapshot';
        snapshotBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error(response?.error || 'Failed to take snapshot');
    }
  } catch (error) {
    console.error('Snapshot error:', error);
    snapshotBtn.textContent = 'Error!';
    setTimeout(() => {
      snapshotBtn.textContent = 'Take Snapshot';
      snapshotBtn.disabled = false;
    }, 2000);
  }
}

/**
 * Attempt to reconnect to native host
 */
async function reconnect() {
  reconnectBtn.disabled = true;
  reconnectBtn.textContent = 'Reconnecting...';

  try {
    await chrome.runtime.sendMessage({ action: 'reconnect' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await checkConnection();
    reconnectBtn.textContent = 'Reconnect Native Host';
  } catch (error) {
    console.error('Reconnect error:', error);
    reconnectBtn.textContent = 'Failed';
  }

  setTimeout(() => {
    reconnectBtn.textContent = 'Reconnect Native Host';
    reconnectBtn.disabled = false;
  }, 2000);
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Event listeners
snapshotBtn.addEventListener('click', takeSnapshot);
reconnectBtn.addEventListener('click', reconnect);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  updateTabInfo();
  checkConnection();
});

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => {
  updateTabInfo();
});
