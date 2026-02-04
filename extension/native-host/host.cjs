#!/usr/bin/env node

/**
 * Native Messaging Host
 *
 * 功能：
 * 1. 与 Chrome 扩展通信 (Native Messaging 协议)
 * 2. 创建 Unix Socket 供 MCP Server 连接
 */

const fs = require('fs');
const net = require('net');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'host.log');
const SOCKET_PATH = '/tmp/agent-browser.sock';

// 清空旧日志
fs.writeFileSync(LOG_FILE, '');

function log(msg) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

// ============================================================
// Native Messaging 协议 (与 Chrome 通信)
// ============================================================

function sendToChrome(obj) {
  const json = JSON.stringify(obj);
  const len = Buffer.byteLength(json, 'utf8');
  const buf = Buffer.alloc(4 + len);
  buf.writeUInt32LE(len, 0);
  buf.write(json, 4, 'utf8');
  process.stdout.write(buf);
  log(`-> Chrome: ${json}`);
}

let buffer = Buffer.alloc(0);

function processStdin() {
  while (buffer.length >= 4) {
    const len = buffer.readUInt32LE(0);
    if (buffer.length < 4 + len) break;

    const json = buffer.subarray(4, 4 + len).toString('utf8');
    buffer = buffer.subarray(4 + len);

    log(`<- Chrome: ${json}`);

    try {
      const msg = JSON.parse(json);
      handleChromeMessage(msg);
    } catch (e) {
      log(`Parse error: ${e.message}`);
    }
  }
}

function handleChromeMessage(msg) {
  // ping/pong 心跳
  if (msg.type === 'ping') {
    sendToChrome({ type: 'pong', id: msg.id });
    return;
  }

  // 来自 Chrome 的响应，转发给 MCP
  if (mcpClient) {
    mcpClient.write(JSON.stringify(msg) + '\n');
    log(`-> MCP: ${JSON.stringify(msg)}`);
  }
}

// ============================================================
// Unix Socket 服务器 (供 MCP 连接)
// ============================================================

let mcpClient = null;

function startSocketServer() {
  // 删除旧的 socket 文件
  try { fs.unlinkSync(SOCKET_PATH); } catch (e) {}

  const server = net.createServer((client) => {
    log('MCP client connected');
    mcpClient = client;

    let clientBuffer = '';

    client.on('data', (data) => {
      clientBuffer += data.toString();
      const lines = clientBuffer.split('\n');
      clientBuffer = lines.pop(); // 保留不完整的行

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          log(`<- MCP: ${JSON.stringify(msg)}`);
          // 转发给 Chrome
          sendToChrome(msg);
        } catch (e) {
          log(`MCP parse error: ${e.message}`);
        }
      }
    });

    client.on('close', () => {
      log('MCP client disconnected');
      mcpClient = null;
    });

    client.on('error', (e) => {
      log(`MCP client error: ${e.message}`);
    });
  });

  server.listen(SOCKET_PATH, () => {
    log(`Socket server listening: ${SOCKET_PATH}`);
    fs.chmodSync(SOCKET_PATH, 0o777);
  });

  server.on('error', (e) => {
    log(`Socket server error: ${e.message}`);
  });
}

// ============================================================
// stdin 处理
// ============================================================

process.stdin.on('readable', () => {
  let chunk;
  while ((chunk = process.stdin.read()) !== null) {
    buffer = Buffer.concat([buffer, chunk]);
    processStdin();
  }
});

process.stdin.on('end', () => {
  log('stdin closed');
});

process.stdin.on('error', (e) => {
  log(`stdin error: ${e.message}`);
});

// 保持进程运行
process.stdin.resume();
setInterval(() => {}, 60000);

// ============================================================
// 启动
// ============================================================

log('=== Native Host Started ===');
startSocketServer();
sendToChrome({ type: 'ready', socket: SOCKET_PATH });
log('Ready message sent');
