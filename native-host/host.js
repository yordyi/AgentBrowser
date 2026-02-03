#!/usr/bin/env node

/**
 * Native Messaging Host for Chrome Extension
 *
 * This host receives commands from the Chrome extension via Native Messaging protocol
 * and forwards them to the MCP Server. It uses a 4-byte length prefix for message framing.
 *
 * Protocol:
 * - Input: 4-byte little-endian length + JSON message
 * - Output: 4-byte little-endian length + JSON response
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const LOG_FILE = process.env.LOG_FILE || join(__dirname, 'host.log');
const IPC_PORT = parseInt(process.env.IPC_PORT || '0', 10); // 0 = random port

/**
 * Simple logger that writes to file when DEBUG is enabled
 */
function log(...args) {
  if (!DEBUG) return;
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  try {
    appendFileSync(LOG_FILE, message);
  } catch {
    // Ignore logging errors
  }
}

/**
 * Read a message from stdin using Native Messaging protocol
 * Messages are prefixed with 4-byte little-endian length
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    let expectedLength = null;

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
    };

    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      log('Received chunk, buffer size:', buffer.length);

      // Read length prefix if we don't have it yet
      if (expectedLength === null && buffer.length >= 4) {
        expectedLength = buffer.readUInt32LE(0);
        log('Expected message length:', expectedLength);

        // Sanity check - messages shouldn't be too large
        if (expectedLength > 1024 * 1024 * 10) { // 10MB limit
          cleanup();
          reject(new Error(`Message too large: ${expectedLength} bytes`));
          return;
        }
      }

      // Check if we have the complete message
      if (expectedLength !== null && buffer.length >= 4 + expectedLength) {
        cleanup();
        const messageBuffer = buffer.slice(4, 4 + expectedLength);
        const messageStr = messageBuffer.toString('utf8');
        log('Received message:', messageStr);

        try {
          const message = JSON.parse(messageStr);
          resolve(message);
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      }
    };

    const onEnd = () => {
      cleanup();
      reject(new Error('stdin closed'));
    };

    const onError = (err) => {
      cleanup();
      reject(err);
    };

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}

/**
 * Send a message to stdout using Native Messaging protocol
 */
function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const length = Buffer.byteLength(json, 'utf8');
  const buffer = Buffer.alloc(4 + length);
  buffer.writeUInt32LE(length, 0);
  buffer.write(json, 4, 'utf8');

  log('Sending message:', json);
  process.stdout.write(buffer);
}

/**
 * Store for pending requests waiting for extension responses
 */
const pendingRequests = new Map();

/**
 * Active extension connection (set when extension connects)
 */
let extensionSocket = null;

/**
 * Queue for messages to send to extension when it connects
 */
const messageQueue = [];

/**
 * Send a command to the extension and wait for response
 */
function sendToExtension(command) {
  return new Promise((resolve, reject) => {
    const id = command.id || randomUUID();
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Extension response timeout'));
    }, 30000); // 30 second timeout

    pendingRequests.set(id, { resolve, reject, timeout });

    const message = { ...command, id };

    if (extensionSocket && !extensionSocket.destroyed) {
      // Send to extension via IPC
      const json = JSON.stringify(message);
      const lengthBuffer = Buffer.alloc(4);
      lengthBuffer.writeUInt32LE(json.length, 0);
      extensionSocket.write(lengthBuffer);
      extensionSocket.write(json);
      log('Sent to extension:', message);
    } else {
      // Queue the message for when extension connects
      messageQueue.push({ id, message, resolve, reject, timeout });
      log('Queued message for extension:', message);
    }
  });
}

/**
 * Handle response from extension
 */
function handleExtensionResponse(response) {
  const { id } = response;
  const pending = pendingRequests.get(id);

  if (pending) {
    clearTimeout(pending.timeout);
    pendingRequests.delete(id);

    if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response);
    }
  } else {
    log('Received response for unknown request:', id);
  }
}

/**
 * Start IPC server for extension communication
 */
function startIPCServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((socket) => {
      log('Extension connected');
      extensionSocket = socket;

      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Process all complete messages in buffer
        while (buffer.length >= 4) {
          const length = buffer.readUInt32LE(0);
          if (buffer.length < 4 + length) break;

          const messageStr = buffer.slice(4, 4 + length).toString('utf8');
          buffer = buffer.slice(4 + length);

          try {
            const message = JSON.parse(messageStr);
            log('Received from extension:', message);
            handleExtensionResponse(message);
          } catch (e) {
            log('Error parsing extension message:', e.message);
          }
        }
      });

      socket.on('close', () => {
        log('Extension disconnected');
        extensionSocket = null;
      });

      socket.on('error', (err) => {
        log('Extension socket error:', err.message);
      });

      // Send queued messages
      while (messageQueue.length > 0) {
        const queued = messageQueue.shift();
        const json = JSON.stringify(queued.message);
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32LE(json.length, 0);
        socket.write(lengthBuffer);
        socket.write(json);
        log('Sent queued message:', queued.message);
      }
    });

    server.on('error', (err) => {
      log('IPC server error:', err.message);
      reject(err);
    });

    server.listen(IPC_PORT, '127.0.0.1', () => {
      const address = server.address();
      log('IPC server listening on port:', address.port);
      resolve(address.port);
    });
  });
}

/**
 * Handle commands from Chrome extension (via Native Messaging)
 */
async function handleCommand(cmd) {
  log('Handling command:', cmd);

  switch (cmd.type) {
    case 'ping':
      return { type: 'pong', timestamp: Date.now() };

    case 'getPort':
      // Return the IPC port for extension to connect
      return { type: 'port', port: globalIpcPort };

    case 'snapshot':
      // Forward to extension and return response
      return await sendToExtension({
        type: 'snapshot',
        interactive: cmd.interactive,
        maxDepth: cmd.maxDepth,
        compact: cmd.compact,
        selector: cmd.selector,
      });

    case 'click':
      return await sendToExtension({
        type: 'click',
        ref: cmd.ref,
        selector: cmd.selector,
        button: cmd.button,
        clickCount: cmd.clickCount,
      });

    case 'fill':
      return await sendToExtension({
        type: 'fill',
        ref: cmd.ref,
        selector: cmd.selector,
        text: cmd.text,
        value: cmd.value,
      });

    case 'type':
      return await sendToExtension({
        type: 'type',
        ref: cmd.ref,
        selector: cmd.selector,
        text: cmd.text,
        delay: cmd.delay,
        clear: cmd.clear,
      });

    case 'navigate':
      return await sendToExtension({
        type: 'navigate',
        url: cmd.url,
        waitUntil: cmd.waitUntil,
      });

    case 'screenshot':
      return await sendToExtension({
        type: 'screenshot',
        ref: cmd.ref,
        selector: cmd.selector,
        fullPage: cmd.fullPage,
        format: cmd.format,
        quality: cmd.quality,
      });

    case 'evaluate':
      return await sendToExtension({
        type: 'evaluate',
        script: cmd.script,
        args: cmd.args,
      });

    case 'scroll':
      return await sendToExtension({
        type: 'scroll',
        ref: cmd.ref,
        selector: cmd.selector,
        x: cmd.x,
        y: cmd.y,
        direction: cmd.direction,
        amount: cmd.amount,
      });

    case 'hover':
      return await sendToExtension({
        type: 'hover',
        ref: cmd.ref,
        selector: cmd.selector,
      });

    case 'select':
      return await sendToExtension({
        type: 'select',
        ref: cmd.ref,
        selector: cmd.selector,
        values: cmd.values,
      });

    case 'press':
      return await sendToExtension({
        type: 'press',
        key: cmd.key,
        modifiers: cmd.modifiers,
      });

    case 'wait':
      return await sendToExtension({
        type: 'wait',
        selector: cmd.selector,
        timeout: cmd.timeout,
        state: cmd.state,
      });

    case 'tabList':
      return await sendToExtension({ type: 'tabList' });

    case 'tabNew':
      return await sendToExtension({
        type: 'tabNew',
        url: cmd.url,
      });

    case 'tabSwitch':
      return await sendToExtension({
        type: 'tabSwitch',
        index: cmd.index,
        tabId: cmd.tabId,
      });

    case 'tabClose':
      return await sendToExtension({
        type: 'tabClose',
        index: cmd.index,
        tabId: cmd.tabId,
      });

    case 'getUrl':
      return await sendToExtension({ type: 'getUrl' });

    case 'getTitle':
      return await sendToExtension({ type: 'getTitle' });

    case 'back':
      return await sendToExtension({ type: 'back' });

    case 'forward':
      return await sendToExtension({ type: 'forward' });

    case 'reload':
      return await sendToExtension({ type: 'reload' });

    default:
      return { error: `Unknown command type: ${cmd.type}` };
  }
}

// Global IPC port
let globalIpcPort = 0;

/**
 * Main entry point
 */
async function main() {
  log('Native host starting...');

  // Set stdin to binary mode
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  // Start IPC server for extension communication
  try {
    globalIpcPort = await startIPCServer();
    log('IPC server started on port:', globalIpcPort);
  } catch (err) {
    log('Failed to start IPC server:', err.message);
    sendMessage({ error: 'Failed to start IPC server: ' + err.message });
    process.exit(1);
  }

  // Main message loop
  while (true) {
    try {
      const msg = await readMessage();
      const result = await handleCommand(msg);
      sendMessage(result);
    } catch (err) {
      log('Error:', err.message);

      // If stdin closed, exit gracefully
      if (err.message === 'stdin closed') {
        log('stdin closed, exiting');
        break;
      }

      sendMessage({ error: err.message });
    }
  }

  log('Native host exiting');
  process.exit(0);
}

// Run
main().catch((err) => {
  log('Fatal error:', err.message);
  sendMessage({ error: 'Fatal error: ' + err.message });
  process.exit(1);
});
