#!/usr/bin/env node

/**
 * Native Messaging Host - 极简版本
 *
 * 协议：4字节小端序长度 + UTF-8 JSON
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'host.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

function send(obj) {
  const json = JSON.stringify(obj);
  const len = Buffer.byteLength(json, 'utf8');
  const buf = Buffer.alloc(4 + len);
  buf.writeUInt32LE(len, 0);
  buf.write(json, 4, 'utf8');
  process.stdout.write(buf);
  log(`-> ${json}`);
}

// 读取消息
let buffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  log(`stdin: ${chunk.length} bytes`);

  while (buffer.length >= 4) {
    const len = buffer.readUInt32LE(0);
    if (buffer.length < 4 + len) break;

    const json = buffer.subarray(4, 4 + len).toString('utf8');
    buffer = buffer.subarray(4 + len);

    log(`<- ${json}`);

    try {
      const msg = JSON.parse(json);
      // Echo back
      send({ received: msg.type || 'unknown', id: msg.id });
    } catch (e) {
      log(`Parse error: ${e.message}`);
    }
  }
});

process.stdin.on('end', () => {
  log('stdin closed');
  process.exit(0);
});

process.stdin.on('error', (e) => {
  log(`stdin error: ${e.message}`);
});

// 启动
log('Host started');
send({ type: 'ready' });
log('Ready sent');
