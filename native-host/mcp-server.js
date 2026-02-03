#!/usr/bin/env node

/**
 * MCP Server for Agent Browser
 *
 * This server exposes browser automation tools via the Model Context Protocol.
 * It communicates with the Native Messaging Host to control the Chrome extension.
 *
 * Usage:
 *   node mcp-server.js
 *
 * The server uses stdio transport for communication with Claude Code.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const HOST_SCRIPT = process.env.HOST_SCRIPT || join(__dirname, 'host.js');

/**
 * Log helper for debugging
 */
function log(...args) {
  if (!DEBUG) return;
  console.error('[MCP Server]', ...args);
}

/**
 * Native Host connection manager
 */
class NativeHostConnection {
  constructor() {
    this.hostProcess = null;
    this.ipcSocket = null;
    this.pendingRequests = new Map();
    this.ipcPort = null;
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Start the native host process
   */
  async start() {
    if (this.hostProcess) {
      log('Host process already running');
      return;
    }

    return new Promise((resolve, reject) => {
      log('Starting native host:', HOST_SCRIPT);

      this.hostProcess = spawn('node', [HOST_SCRIPT], {
        stdio: ['pipe', 'pipe', 'inherit'],
        env: { ...process.env, DEBUG: DEBUG ? '1' : '0' },
      });

      this.hostProcess.on('error', (err) => {
        log('Host process error:', err);
        reject(err);
      });

      this.hostProcess.on('exit', (code) => {
        log('Host process exited with code:', code);
        this.hostProcess = null;
        this.ipcSocket = null;
      });

      // Set up stdout reading for native messaging protocol
      this.buffer = Buffer.alloc(0);

      this.hostProcess.stdout.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.processBuffer();
      });

      // Request the IPC port from the host
      this.sendToHost({ type: 'getPort' })
        .then((response) => {
          this.ipcPort = response.port;
          log('Got IPC port:', this.ipcPort);
          return this.connectIPC();
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Process incoming data from host
   */
  processBuffer() {
    while (this.buffer.length >= 4) {
      const length = this.buffer.readUInt32LE(0);
      if (this.buffer.length < 4 + length) break;

      const messageStr = this.buffer.slice(4, 4 + length).toString('utf8');
      this.buffer = this.buffer.slice(4 + length);

      try {
        const message = JSON.parse(messageStr);
        log('Received from host:', message);
        this.handleHostResponse(message);
      } catch (e) {
        log('Error parsing host message:', e.message);
      }
    }
  }

  /**
   * Handle response from host
   */
  handleHostResponse(response) {
    // Find the pending request (responses come in order for stdio)
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(id);

      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        pending.resolve(response);
      }
      break;
    }
  }

  /**
   * Send message to host via native messaging protocol
   */
  sendToHost(message) {
    return new Promise((resolve, reject) => {
      if (!this.hostProcess) {
        reject(new Error('Host process not running'));
        return;
      }

      const id = randomUUID();
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Host response timeout'));
      }, 30000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const json = JSON.stringify({ ...message, id });
      const length = Buffer.byteLength(json, 'utf8');
      const buffer = Buffer.alloc(4 + length);
      buffer.writeUInt32LE(length, 0);
      buffer.write(json, 4, 'utf8');

      log('Sending to host:', json);
      this.hostProcess.stdin.write(buffer);
    });
  }

  /**
   * Connect to host's IPC server for extension communication
   */
  async connectIPC() {
    if (!this.ipcPort) {
      throw new Error('IPC port not available');
    }

    return new Promise((resolve, reject) => {
      log('Connecting to IPC on port:', this.ipcPort);

      this.ipcSocket = createConnection({ port: this.ipcPort, host: '127.0.0.1' }, () => {
        log('Connected to IPC server');
        resolve();
      });

      this.ipcSocket.on('error', (err) => {
        log('IPC socket error:', err.message);
        reject(err);
      });

      this.ipcSocket.on('close', () => {
        log('IPC socket closed');
        this.ipcSocket = null;
      });
    });
  }

  /**
   * Send command via native host (which forwards to extension)
   */
  async sendCommand(command) {
    await this.start();
    return this.sendToHost(command);
  }

  /**
   * Cleanup
   */
  async stop() {
    if (this.ipcSocket) {
      this.ipcSocket.destroy();
      this.ipcSocket = null;
    }

    if (this.hostProcess) {
      this.hostProcess.kill();
      this.hostProcess = null;
    }
  }
}

// Global connection instance
const hostConnection = new NativeHostConnection();

/**
 * Tool definitions for MCP
 */
const tools = [
  {
    name: 'snapshot',
    description: 'Get accessibility tree snapshot of the current page with element references. Returns a hierarchical text representation where interactive elements have refs like [ref=e1] that can be used for click/fill actions.',
    inputSchema: {
      type: 'object',
      properties: {
        interactive: {
          type: 'boolean',
          description: 'Only include interactive elements (buttons, links, inputs)',
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum depth of tree to traverse',
        },
        compact: {
          type: 'boolean',
          description: 'Remove structural elements without meaningful content',
        },
        selector: {
          type: 'string',
          description: 'CSS selector to scope the snapshot to a specific element',
        },
      },
    },
  },
  {
    name: 'click',
    description: 'Click an element on the page. Use refs from snapshot (e.g., @e1) or CSS selectors.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference from snapshot (e.g., @e1, e1)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector (alternative to ref)',
        },
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button to use (default: left)',
        },
        clickCount: {
          type: 'number',
          description: 'Number of clicks (1 for single, 2 for double)',
        },
      },
    },
  },
  {
    name: 'fill',
    description: 'Fill a form field with text. Clears existing content first.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference from snapshot (e.g., @e1)',
        },
        selector: {
          type: 'string',
          description: 'CSS selector (alternative to ref)',
        },
        text: {
          type: 'string',
          description: 'Text to fill into the field',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'type',
    description: 'Type text character by character. Use for inputs that need keystrokes.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference from snapshot',
        },
        selector: {
          type: 'string',
          description: 'CSS selector (alternative to ref)',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        delay: {
          type: 'number',
          description: 'Delay between keystrokes in milliseconds',
        },
        clear: {
          type: 'boolean',
          description: 'Clear existing content before typing',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'navigate',
    description: 'Navigate to a URL in the current tab.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to',
        },
        waitUntil: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          description: 'When to consider navigation complete (default: load)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'screenshot',
    description: 'Take a screenshot of the page or a specific element.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference to screenshot',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of element to screenshot',
        },
        fullPage: {
          type: 'boolean',
          description: 'Capture full page (default: viewport only)',
        },
        format: {
          type: 'string',
          enum: ['png', 'jpeg'],
          description: 'Image format (default: png)',
        },
        quality: {
          type: 'number',
          description: 'JPEG quality 0-100 (only for jpeg format)',
        },
      },
    },
  },
  {
    name: 'evaluate',
    description: 'Execute JavaScript code in the page context.',
    inputSchema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description: 'JavaScript code to execute',
        },
        args: {
          type: 'array',
          description: 'Arguments to pass to the script',
        },
      },
      required: ['script'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page or an element.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference to scroll',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of element to scroll',
        },
        x: {
          type: 'number',
          description: 'Horizontal scroll amount in pixels',
        },
        y: {
          type: 'number',
          description: 'Vertical scroll amount in pixels',
        },
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'Scroll direction',
        },
        amount: {
          type: 'number',
          description: 'Scroll amount in pixels (used with direction)',
        },
      },
    },
  },
  {
    name: 'hover',
    description: 'Hover over an element.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference to hover over',
        },
        selector: {
          type: 'string',
          description: 'CSS selector (alternative to ref)',
        },
      },
    },
  },
  {
    name: 'select',
    description: 'Select option(s) in a dropdown.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description: 'Element reference for select element',
        },
        selector: {
          type: 'string',
          description: 'CSS selector for select element',
        },
        values: {
          type: 'array',
          items: { type: 'string' },
          description: 'Values to select',
        },
      },
      required: ['values'],
    },
  },
  {
    name: 'press',
    description: 'Press a keyboard key or key combination.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key to press (e.g., "Enter", "Tab", "Control+a")',
        },
        modifiers: {
          type: 'array',
          items: { type: 'string' },
          description: 'Modifier keys (Control, Shift, Alt, Meta)',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'wait',
    description: 'Wait for an element to appear or a timeout.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to wait for',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds',
        },
        state: {
          type: 'string',
          enum: ['attached', 'detached', 'visible', 'hidden'],
          description: 'State to wait for (default: visible)',
        },
      },
    },
  },
  {
    name: 'tabList',
    description: 'List all open browser tabs.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'tabNew',
    description: 'Open a new browser tab.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to open in new tab',
        },
      },
    },
  },
  {
    name: 'tabSwitch',
    description: 'Switch to a different tab.',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'number',
          description: 'Tab index (0-based)',
        },
        tabId: {
          type: 'number',
          description: 'Tab ID (alternative to index)',
        },
      },
    },
  },
  {
    name: 'tabClose',
    description: 'Close a browser tab.',
    inputSchema: {
      type: 'object',
      properties: {
        index: {
          type: 'number',
          description: 'Tab index to close (default: current tab)',
        },
        tabId: {
          type: 'number',
          description: 'Tab ID to close (alternative to index)',
        },
      },
    },
  },
  {
    name: 'getUrl',
    description: 'Get the current page URL.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getTitle',
    description: 'Get the current page title.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'back',
    description: 'Navigate back in browser history.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'forward',
    description: 'Navigate forward in browser history.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'reload',
    description: 'Reload the current page.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Create and configure the MCP server
 */
function createMCPServer() {
  const server = new Server(
    {
      name: 'agent-browser',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    log('Tool call:', name, args);

    try {
      const response = await hostConnection.sendCommand({
        type: name,
        ...args,
      });

      // Format response for MCP
      let content;
      if (typeof response === 'object') {
        // Remove internal fields
        const { id, type, ...data } = response;
        content = JSON.stringify(data, null, 2);
      } else {
        content = String(response);
      }

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  log('Starting MCP server...');

  const server = createMCPServer();
  const transport = new StdioServerTransport();

  // Handle shutdown
  process.on('SIGINT', async () => {
    log('Shutting down...');
    await hostConnection.stop();
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    log('Shutting down...');
    await hostConnection.stop();
    await server.close();
    process.exit(0);
  });

  // Start the server
  await server.connect(transport);
  log('MCP server running');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
