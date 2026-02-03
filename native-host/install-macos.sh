#!/bin/bash

# Native Messaging Host Installation Script for macOS
#
# This script installs the Agent Browser Native Messaging Host
# for Chrome/Chromium-based browsers on macOS.
#
# Usage:
#   ./install-macos.sh [EXTENSION_ID]
#
# Arguments:
#   EXTENSION_ID - The Chrome extension ID (optional, can be set later)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_PATH="${SCRIPT_DIR}/host.js"

# Extension ID from argument or placeholder
EXTENSION_ID="${1:-EXTENSION_ID_PLACEHOLDER}"

# Native Messaging Host name
HOST_NAME="com.agent_browser.host"

# Possible manifest locations for different browsers
CHROME_USER_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
CHROME_BETA_USER_DIR="$HOME/Library/Application Support/Google/Chrome Beta/NativeMessagingHosts"
CHROME_CANARY_USER_DIR="$HOME/Library/Application Support/Google/Chrome Canary/NativeMessagingHosts"
CHROMIUM_USER_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
BRAVE_USER_DIR="$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
EDGE_USER_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
ARC_USER_DIR="$HOME/Library/Application Support/Arc/User Data/NativeMessagingHosts"

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if host.js exists
if [[ ! -f "$HOST_PATH" ]]; then
    print_error "host.js not found at: $HOST_PATH"
    exit 1
fi

# Make host.js executable
chmod +x "$HOST_PATH"
print_info "Made host.js executable"

# Function to install manifest for a browser
install_manifest() {
    local browser_name="$1"
    local manifest_dir="$2"

    # Skip if browser directory doesn't exist
    if [[ ! -d "$(dirname "$manifest_dir")" ]]; then
        return 0
    fi

    # Create manifest directory if needed
    mkdir -p "$manifest_dir"

    local manifest_path="${manifest_dir}/${HOST_NAME}.json"

    # Create the manifest
    cat > "$manifest_path" << EOF
{
  "name": "${HOST_NAME}",
  "description": "Agent Browser Native Messaging Host - Bridges Chrome extension with MCP Server",
  "path": "${HOST_PATH}",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://${EXTENSION_ID}/"
  ]
}
EOF

    print_info "Installed manifest for ${browser_name} at: ${manifest_path}"
    return 1
}

# Track if any browser was configured
INSTALLED_COUNT=0

# Install for Chrome
if install_manifest "Google Chrome" "$CHROME_USER_DIR"; then
    : # No-op, browser not found
else
    ((INSTALLED_COUNT++))
fi

# Install for Chrome Beta
if install_manifest "Google Chrome Beta" "$CHROME_BETA_USER_DIR"; then
    :
else
    ((INSTALLED_COUNT++))
fi

# Install for Chrome Canary
if install_manifest "Google Chrome Canary" "$CHROME_CANARY_USER_DIR"; then
    :
else
    ((INSTALLED_COUNT++))
fi

# Install for Chromium
if install_manifest "Chromium" "$CHROMIUM_USER_DIR"; then
    :
else
    ((INSTALLED_COUNT++))
fi

# Install for Brave
if install_manifest "Brave Browser" "$BRAVE_USER_DIR"; then
    :
else
    ((INSTALLED_COUNT++))
fi

# Install for Microsoft Edge
if install_manifest "Microsoft Edge" "$EDGE_USER_DIR"; then
    :
else
    ((INSTALLED_COUNT++))
fi

# Install for Arc Browser
if install_manifest "Arc Browser" "$ARC_USER_DIR"; then
    :
else
    ((INSTALLED_COUNT++))
fi

if [[ $INSTALLED_COUNT -eq 0 ]]; then
    print_warn "No supported browsers found. Please manually install the manifest."
    print_warn "Manifest should be placed in: ~/Library/Application Support/<Browser>/NativeMessagingHosts/"
fi

echo ""
print_info "Installation complete!"
echo ""

if [[ "$EXTENSION_ID" == "EXTENSION_ID_PLACEHOLDER" ]]; then
    print_warn "Extension ID not provided. You need to update the manifest(s) with your actual extension ID."
    echo ""
    echo "To get your extension ID:"
    echo "  1. Open chrome://extensions in your browser"
    echo "  2. Enable 'Developer mode'"
    echo "  3. Find your extension and copy the ID"
    echo ""
    echo "Then run this script again with the extension ID:"
    echo "  ./install-macos.sh YOUR_EXTENSION_ID"
fi

echo ""
echo "Files installed:"
echo "  Host script: ${HOST_PATH}"
echo "  Manifest(s): ~/Library/Application Support/<Browser>/NativeMessagingHosts/${HOST_NAME}.json"
echo ""
echo "To verify installation, restart your browser and check the extension."
