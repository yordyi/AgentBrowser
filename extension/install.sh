#!/bin/bash

# Agent Browser V2 - 安装脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_DIR="$SCRIPT_DIR/native-host"

echo "=== Agent Browser V2 安装 ==="
echo ""

# 检查 Extension ID 参数
if [ -z "$1" ]; then
  echo "用法: ./install.sh <extension-id>"
  echo ""
  echo "步骤:"
  echo "1. 在 Arc 中加载扩展 (arc://extensions)"
  echo "2. 复制扩展 ID"
  echo "3. 运行: ./install.sh <extension-id>"
  exit 1
fi

EXT_ID="$1"
echo "Extension ID: $EXT_ID"

# 检测浏览器
ARC_PATH="$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"
CHROME_PATH="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

# 创建 manifest
create_manifest() {
  local dir="$1"
  mkdir -p "$dir"
  cat > "$dir/com.agent_browser.host.json" << EOF
{
  "name": "com.agent_browser.host",
  "description": "Agent Browser V2 Native Host",
  "path": "$HOST_DIR/run.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
EOF
  echo "已安装到: $dir"
}

# 安装
if [ -d "$ARC_PATH" ] || [ -d "$(dirname "$ARC_PATH")" ]; then
  create_manifest "$ARC_PATH"
fi

if [ -d "$CHROME_PATH" ] || [ -d "$(dirname "$CHROME_PATH")" ]; then
  create_manifest "$CHROME_PATH"
fi

echo ""
echo "=== 安装完成 ==="
echo "现在刷新扩展并检查 Service Worker 控制台"
