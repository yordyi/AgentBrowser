# Agent Browser Chrome Extension Design

## Overview

Create a Chrome extension that combines the best of both worlds:
- **Claude in Chrome's** ability to control already-logged-in browsers without restart
- **agent-browser's** efficient Ref system (`@e1`, `@e2`) that saves ~93% tokens vs screenshots

## Problem Statement

Current approaches have trade-offs:

| Tool | Pros | Cons |
|------|------|------|
| Claude in Chrome | Controls logged-in browser | Screenshot-based, high token usage |
| agent-browser (CDP) | Efficient Ref system | Requires Chrome restart with debug port |
| OpenAI Operator | Visual recognition | Pure screenshots, coordinate-based |

**Goal:** Efficient Ref system + No browser restart required

## Architecture

```
Claude Code
    |
    | MCP (stdio)
    v
+-------------------+
| MCP Server        |  (Node.js process)
| - snapshot        |
| - click @ref      |
| - fill @ref       |
| - navigate        |
| - screenshot      |
+-------------------+
    |
    | Native Messaging (stdio + length prefix)
    v
+-------------------+
| Native Host       |  (Node.js, registered with Chrome)
+-------------------+
    |
    | chrome.runtime.connectNative()
    v
+-------------------+
| Chrome Extension  |
| - background.js   |  (Service Worker)
| - content.js      |  (Page context)
+-------------------+
    |
    | DOM API
    v
+-------------------+
| Web Page          |
| (already logged   |
|  in, no restart)  |
+-------------------+
```

## Design Decisions

### 1. Product Positioning
**Decision:** Independent plugin, replacing Claude in Chrome

**Rationale:**
- Clean architecture without legacy constraints
- Can focus on efficiency from the start
- Users can choose which to use

### 2. Communication Method
**Decision:** MCP over Native Messaging

**Rationale:**
- Native Messaging is Chrome's official extension <-> native app API
- MCP is Claude Code's standard tool protocol
- stdio transport is simple and reliable

### 3. Feature Scope
**Decision:** Minimal viable set

Core tools:
- `snapshot` - Get page structure with Refs
- `click @ref` - Click element by reference
- `fill @ref "text"` - Fill form field
- `navigate url` - Page navigation
- `screenshot` - Visual capture (fallback)

## Token Efficiency Comparison

### Screenshot-based (Claude in Chrome)
```
- Base64 image: ~5000-10000 tokens per screenshot
- Multiple screenshots per interaction
- Total: 15000-30000 tokens per task
```

### Ref-based (this extension)
```
- Text snapshot: ~200-400 tokens
- Ref commands: ~10 tokens each
- Total: 300-600 tokens per task
```

**Savings: ~93-98%**

## Implementation Plan

### Phase 1: Extension Core (feature/extension-core)
- [ ] manifest.json (MV3)
- [ ] background.js (Service Worker)
- [ ] content.js (Page script)
- [ ] Message passing between background <-> content

### Phase 2: Snapshot Port (feature/snapshot-browser)
- [ ] Port RefMap, EnhancedSnapshot interfaces
- [ ] Implement getRole() using DOM API
- [ ] Implement getAccessibleName()
- [ ] Implement buildSnapshot()
- [ ] Implement resolveRef()

### Phase 3: Native + MCP (feature/native-mcp)
- [ ] Native Messaging Host (host.js)
- [ ] Native Messaging manifest
- [ ] Install scripts (macOS, Linux)
- [ ] MCP Server with 5 tools

### Phase 4: Integration
- [ ] Merge all branches
- [ ] End-to-end testing
- [ ] Documentation

## File Structure

```
extension/
├── manifest.json
├── background.js
├── content.js
├── snapshot-browser.js
└── popup/
    ├── popup.html
    └── popup.js

native-host/
├── host.js
├── manifest.json
├── mcp-server.js
├── install-macos.sh
└── install-linux.sh
```

## Security Considerations

- Extension requires `<all_urls>` permission (same as Claude in Chrome)
- Native Messaging only allows pre-registered extensions
- No sensitive data leaves the local machine (MCP is stdio-based)

## Future Enhancements

1. **Tab management** - Switch between tabs
2. **Iframe support** - Handle nested frames
3. **Shadow DOM** - Access shadow roots
4. **Wait conditions** - Wait for elements/network
5. **Batch commands** - Multiple actions per round-trip
