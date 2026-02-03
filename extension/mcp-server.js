#!/usr/bin/env node

/**
 * Agent Browser MCP Server
 *
 * 通过 Unix Socket 连接 Native Host，暴露浏览器操作给 Claude Code
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import net from 'net';

const SOCKET_PATH = '/tmp/agent-browser.sock';

// ============================================================
// Unix Socket 客户端
// ============================================================

let socket = null;
let messageId = 0;
const pendingRequests = new Map();

function connect() {
  return new Promise((resolve, reject) => {
    socket = net.connect(SOCKET_PATH, () => {
      console.error('[MCP] Connected to Native Host');
      resolve();
    });

    socket.on('error', (e) => {
      console.error('[MCP] Socket error:', e.message);
      reject(e);
    });

    socket.on('close', () => {
      console.error('[MCP] Socket closed');
      socket = null;
    });

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 4) {
        const len = buffer.readUInt32LE(0);
        if (buffer.length < 4 + len) break;

        const json = buffer.subarray(4, 4 + len).toString('utf8');
        buffer = buffer.subarray(4 + len);

        try {
          const msg = JSON.parse(json);
          const resolver = pendingRequests.get(msg.id);
          if (resolver) {
            pendingRequests.delete(msg.id);
            resolver(msg);
          }
        } catch (e) {
          console.error('[MCP] Parse error:', e.message);
        }
      }
    });
  });
}

function sendCommand(type, params = {}) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Not connected to Native Host'));
      return;
    }

    const id = `mcp-${++messageId}`;
    const msg = { id, type, ...params };

    pendingRequests.set(id, resolve);

    const json = JSON.stringify(msg);
    const len = Buffer.byteLength(json, 'utf8');
    const buf = Buffer.alloc(4 + len);
    buf.writeUInt32LE(len, 0);
    buf.write(json, 4, 'utf8');
    socket.write(buf);

    // 超时
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Command timeout'));
      }
    }, 30000);
  });
}

// ============================================================
// MCP Server
// ============================================================

const server = new Server(
  {
    name: 'agent-browser',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'browser_snapshot',
        description: 'Get page snapshot with element references (refs). Returns URL, title, and all interactive elements with their refs for subsequent actions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'browser_click',
        description: 'Click an element by ref (from snapshot) or CSS selector',
        inputSchema: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Element ref from snapshot (e.g., "e1", "e5")' },
            selector: { type: 'string', description: 'CSS selector as fallback' },
          },
        },
      },
      {
        name: 'browser_fill',
        description: 'Fill a form field with text (clears existing value)',
        inputSchema: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Element ref from snapshot' },
            selector: { type: 'string', description: 'CSS selector as fallback' },
            value: { type: 'string', description: 'Text to fill' },
          },
          required: ['value'],
        },
      },
      {
        name: 'browser_type',
        description: 'Type text character by character (triggers key events)',
        inputSchema: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Element ref from snapshot' },
            selector: { type: 'string', description: 'CSS selector as fallback' },
            text: { type: 'string', description: 'Text to type' },
          },
          required: ['text'],
        },
      },
      {
        name: 'browser_navigate',
        description: 'Navigate to a URL',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
          },
          required: ['url'],
        },
      },
      {
        name: 'browser_back',
        description: 'Go back in browser history',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'browser_forward',
        description: 'Go forward in browser history',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'browser_reload',
        description: 'Reload the current page',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'browser_scroll',
        description: 'Scroll the page',
        inputSchema: {
          type: 'object',
          properties: {
            direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction' },
            amount: { type: 'number', description: 'Pixels to scroll (default: 300)' },
          },
        },
      },
      {
        name: 'browser_screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['png', 'jpeg'], description: 'Image format (default: png)' },
            quality: { type: 'number', description: 'JPEG quality 0-100 (only for jpeg)' },
          },
        },
      },
      {
        name: 'browser_tabs',
        description: 'List all browser tabs',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'browser_tab_new',
        description: 'Create a new tab',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to open (default: about:blank)' },
          },
        },
      },
      {
        name: 'browser_tab_switch',
        description: 'Switch to a specific tab',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab ID to switch to' },
            index: { type: 'number', description: 'Tab index (0-based) as alternative' },
          },
        },
      },
      {
        name: 'browser_tab_close',
        description: 'Close a tab',
        inputSchema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab ID to close (default: current tab)' },
          },
        },
      },
      {
        name: 'browser_hover',
        description: 'Hover over an element',
        inputSchema: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'Element ref from snapshot' },
            selector: { type: 'string', description: 'CSS selector as fallback' },
          },
        },
      },
      {
        name: 'browser_press',
        description: 'Press a keyboard key',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Key to press (e.g., "Enter", "Escape", "Tab")' },
          },
          required: ['key'],
        },
      },
      {
        name: 'browser_evaluate',
        description: 'Execute JavaScript in the page context',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'JavaScript code to execute' },
          },
          required: ['code'],
        },
      },
    ],
  };
});

// 工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'browser_snapshot':
        result = await sendCommand('snapshot');
        // 格式化输出
        if (result.success) {
          const { url, title, elements, viewport } = result;
          let text = `URL: ${url}\nTitle: ${title}\nViewport: ${viewport.width}x${viewport.height}\n\nElements (${elements.length}):\n`;
          for (const el of elements) {
            text += `[${el.ref}] <${el.tag}>`;
            if (el.text) text += ` "${el.text}"`;
            if (el.href) text += ` href="${el.href}"`;
            if (el.type) text += ` type="${el.type}"`;
            if (el.placeholder) text += ` placeholder="${el.placeholder}"`;
            text += '\n';
          }
          return { content: [{ type: 'text', text }] };
        }
        break;

      case 'browser_click':
        result = await sendCommand('click', args);
        break;

      case 'browser_fill':
        result = await sendCommand('fill', args);
        break;

      case 'browser_type':
        result = await sendCommand('type', args);
        break;

      case 'browser_navigate':
        result = await sendCommand('navigate', args);
        break;

      case 'browser_back':
        result = await sendCommand('back');
        break;

      case 'browser_forward':
        result = await sendCommand('forward');
        break;

      case 'browser_reload':
        result = await sendCommand('reload');
        break;

      case 'browser_scroll':
        result = await sendCommand('scroll', args);
        break;

      case 'browser_screenshot':
        result = await sendCommand('screenshot', args);
        if (result.success && result.screenshot) {
          return {
            content: [
              {
                type: 'image',
                data: result.screenshot.replace(/^data:image\/\w+;base64,/, ''),
                mimeType: args?.format === 'jpeg' ? 'image/jpeg' : 'image/png',
              },
            ],
          };
        }
        break;

      case 'browser_tabs':
        result = await sendCommand('tabList');
        if (result.success) {
          let text = 'Browser Tabs:\n';
          for (const tab of result.tabs) {
            text += `${tab.active ? '→ ' : '  '}[${tab.id}] ${tab.title}\n    ${tab.url}\n`;
          }
          return { content: [{ type: 'text', text }] };
        }
        break;

      case 'browser_tab_new':
        result = await sendCommand('tabNew', args);
        break;

      case 'browser_tab_switch':
        result = await sendCommand('tabSwitch', args);
        break;

      case 'browser_tab_close':
        result = await sendCommand('tabClose', args);
        break;

      case 'browser_hover':
        result = await sendCommand('hover', args);
        break;

      case 'browser_press':
        result = await sendCommand('press', args);
        break;

      case 'browser_evaluate':
        result = await sendCommand('evaluate', args);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    if (result.error) {
      return { content: [{ type: 'text', text: `Error: ${result.error}` }], isError: true };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };

  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

// ============================================================
// 启动
// ============================================================

async function main() {
  try {
    await connect();
  } catch (e) {
    console.error('[MCP] Failed to connect to Native Host. Is Chrome extension running?');
    console.error('[MCP] Error:', e.message);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Server started');
}

main().catch(console.error);
