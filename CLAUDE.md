# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

agent-browser is a headless browser automation CLI for AI agents. It provides a fast Rust CLI (with Node.js fallback) to control Chromium browsers via Playwright. Key innovation: deterministic element refs (`@e1`, `@e2`) in accessibility snapshots for AI-friendly element selection.

## Commands

```bash
# Build
pnpm build              # TypeScript compilation
pnpm build:native       # Compile Rust CLI (requires Rust)

# Test
pnpm test               # Run all tests
pnpm test:watch         # Watch mode
npx vitest run src/protocol.test.ts  # Run single test file

# Development
pnpm dev                # Run daemon with live reload (tsx)
pnpm start              # Run compiled daemon

# Formatting
pnpm format             # Prettier
pnpm format:check       # Check without writing
```

## Architecture

**Client-Daemon Model:**
```
┌─────────────┐    socket/TCP    ┌─────────────┐    Playwright    ┌─────────────┐
│  Rust CLI   │ ───────────────→ │ Node Daemon │ ───────────────→ │  Chromium   │
│  (cli/src/) │                  │  (src/)     │                  │             │
└─────────────┘                  └─────────────┘                  └─────────────┘
```

- **Rust CLI** (`cli/src/`): Fast command parsing, socket communication. Falls back to Node.js wrapper if binary unavailable.
- **Node Daemon** (`src/daemon.ts`): Persistent background service managing browser lifecycle. Starts on first CLI command.
- **Communication**: Unix sockets (`~/.agent-browser/<session>.sock`) on Unix, TCP (ports 49152-65535) on Windows.

**Core Source Files:**
- `src/daemon.ts` - Socket server, session management
- `src/browser.ts` - Playwright browser lifecycle, tab/frame management
- `src/actions.ts` - Command execution engine (100+ commands)
- `src/types.ts` - TypeScript command & response types
- `src/protocol.ts` - Zod validation schemas for all commands
- `src/snapshot.ts` - Accessibility tree + ref system (`@e1`, `@e2`)
- `src/ios-manager.ts` - iOS Simulator/real device support via Appium
- `src/stream-server.ts` - WebSocket server for browser streaming

**Rust CLI Files:**
- `cli/src/main.rs` - Entry point
- `cli/src/commands.rs` - Command parsing & construction
- `cli/src/connection.rs` - Socket/daemon communication
- `cli/src/output.rs` - Formatted output & help text

## Code Style

From AGENTS.md:
- No emojis in code, output, or documentation. Unicode symbols (✓, ✗, →, ⚠) are acceptable.
- CLI colors via `cli/src/color.rs`. Respects `NO_COLOR` env var. Never use hardcoded ANSI codes.

## Testing Notes

- Test timeout is 30 seconds (accounts for Playwright operations)
- Protocol validation tests are comprehensive (`src/protocol.test.ts`, 1000+ lines)
- Browser tests require Chromium installed (`agent-browser install`)

## Key Concepts

**Ref System**: `agent-browser snapshot` generates accessibility tree with deterministic refs. AI agents use refs (e.g., `@e2`) instead of brittle CSS selectors:
```
- heading "Example" [ref=e1]
- button "Submit" [ref=e2]
- textbox "Email" [ref=e3]
```

**Sessions**: Multiple isolated browser instances via `--session <name>`. Each has separate cookies, storage, history.

**Providers**: Pluggable backends - local Playwright (default), Browserbase, Kernel, iOS Appium. Switch via `--provider` or `AGENT_BROWSER_PROVIDER`.

## Development Workflow

**Git Worktrees**: Use `.worktrees/` directory for isolated feature development (project-local, hidden).

```bash
# Create new worktree for a feature
git worktree add .worktrees/feature-name -b feature/feature-name

# List all worktrees
git worktree list

# Remove worktree after merge
git worktree remove .worktrees/feature-name
```
