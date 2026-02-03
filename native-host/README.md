# Agent Browser Native Host

Native Messaging Host and MCP Server for the Agent Browser Chrome Extension.

## Architecture

```
Claude Code <---> MCP Server <---> Native Host <---> Chrome Extension
                   (stdio)         (Native Messaging)      (IPC)
```

- **MCP Server** (`mcp-server.js`): Exposes browser automation tools via Model Context Protocol
- **Native Host** (`host.js`): Bridge between MCP Server and Chrome Extension using Native Messaging protocol
- **Chrome Extension**: Controls the actual browser (tabs, DOM, navigation)

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Chrome/Chromium-based browser
- The Agent Browser Chrome Extension installed

### 1. Install Dependencies

```bash
cd native-host
npm install
```

### 2. Install Native Messaging Host

The Native Messaging Host must be registered with your browser.

**macOS:**
```bash
./install-macos.sh YOUR_EXTENSION_ID
```

**Linux:**
```bash
./install-linux.sh YOUR_EXTENSION_ID
```

**Windows (PowerShell as Administrator):**
```powershell
.\install-windows.ps1 -ExtensionId YOUR_EXTENSION_ID
```

To find your Extension ID:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Copy the ID shown under your extension

### 3. Configure Claude Code

Add the MCP server to your Claude Code configuration:

**~/.claude/claude_desktop_config.json:**
```json
{
  "mcpServers": {
    "agent-browser": {
      "command": "node",
      "args": ["/path/to/native-host/mcp-server.js"],
      "env": {
        "DEBUG": "0"
      }
    }
  }
}
```

## Usage

Once configured, Claude Code will have access to browser automation tools:

- `snapshot` - Get accessibility tree of current page
- `click` - Click elements by ref or selector
- `fill` - Fill form fields
- `type` - Type text character by character
- `navigate` - Navigate to URLs
- `screenshot` - Take screenshots
- `evaluate` - Execute JavaScript
- `scroll` - Scroll page or elements
- `hover` - Hover over elements
- `select` - Select dropdown options
- `press` - Press keyboard keys
- `wait` - Wait for elements or timeout
- `tabList` - List open tabs
- `tabNew` - Open new tab
- `tabSwitch` - Switch tabs
- `tabClose` - Close tab
- `getUrl` - Get current URL
- `getTitle` - Get page title
- `back` / `forward` / `reload` - Navigation controls

## Debugging

Enable debug logging:

```bash
DEBUG=1 node mcp-server.js
```

Logs are written to `host.log` in the native-host directory.

## Native Messaging Protocol

The Native Messaging protocol uses length-prefixed JSON messages:

- **Input**: 4-byte little-endian length prefix + UTF-8 JSON
- **Output**: 4-byte little-endian length prefix + UTF-8 JSON

This allows Chrome to communicate with local applications securely.

## Troubleshooting

### "Native host has exited"

1. Check that Node.js is installed and in PATH
2. Verify the manifest path is correct and absolute
3. Check the host.log file for errors

### "Extension ID not allowed"

1. Update the manifest with your correct extension ID
2. Re-run the installation script
3. Restart your browser

### "Connection refused"

1. Ensure the Chrome extension is loaded and active
2. Check that the extension has permission to use Native Messaging
3. Verify the IPC server is running (check logs)

## License

Apache-2.0
