# Test Coverage Analysis

## Current State

7 test files, ~214 test cases total.

| Source File | Lines | Test File | Test Cases | Coverage |
|---|---|---|---|---|
| `src/protocol.ts` | 977 | `protocol.test.ts` | 112 | Strong |
| `src/browser.ts` | 1,877 | `browser.test.ts` | 63 | Moderate |
| `src/daemon.ts` | 451 | `daemon.test.ts` | 12 | Weak |
| `src/actions.ts` | 2,043 | `actions.test.ts` | 2 | Critical gap |
| `src/snapshot.ts` | 465 | *(none)* | 0 | No coverage |
| `src/stream-server.ts` | 382 | *(none)* | 0 | No coverage |
| `src/ios-actions.ts` | 273 | *(none)* | 0 | No coverage |
| `src/ios-manager.ts` | 1,299 | `ios-manager.test.ts` | 10 | Weak |
| `src/types.ts` | 1,074 | N/A | N/A | Types only |

Integration tests: `test/launch-options.test.ts` (9 cases), `test/serverless.test.ts` (6 cases, conditionally skipped).

No coverage tooling is configured (no `@vitest/coverage-v8`, no thresholds, no CI reporting).

---

## Priority 1: `src/actions.ts` (2,043 lines, 2 tests)

The largest source file and core command execution engine. Only `toAIFriendlyError` (a helper) is tested with 2 cases. The 60+ action handlers in `executeCommand()` have zero coverage.

### Recommended tests

- **`toAIFriendlyError` full branch coverage**: strict mode violation, element not visible, timeout exceeded, element not found waiting, and the passthrough case (4 additional test cases).
- **`executeCommand()` dispatch**: verify each action routes to the correct handler and returns the expected response shape. Use a mocked `BrowserManager` to avoid needing a real browser.
- **Error handling**: verify that exceptions thrown by browser methods are caught and returned as proper error responses with `success: false`.
- **Edge cases**: unknown action types reaching the executor.

---

## Priority 2: `src/snapshot.ts` (465 lines, 0 tests)

The snapshot module is the project's key innovation (deterministic `@e1`, `@e2` refs). It contains rich pure-function logic that is highly testable without any browser:

### Recommended tests

- **`processAriaTree()`**: pass in raw ARIA tree strings and verify correct `[ref=eN]` annotations, proper filtering for interactive/compact/maxDepth modes.
- **`buildSelector()`**: verify correct Playwright locator strings, especially name escaping with quotes.
- **`parseRef()`**: test `@e1`, `ref=e1`, `e1`, and invalid inputs.
- **`getSnapshotStats()`**: verify line/char/token/ref/interactive counts.
- **`createRoleNameTracker()`**: verify duplicate detection, `getNextIndex` incrementing, `getDuplicateKeys` accuracy.
- **`removeNthFromNonDuplicates()`**: verify `nth` is kept for duplicates and removed for unique elements.
- **`compactTree()`**: verify structural branches without refs are removed, branches with ref children are kept.
- **`getIndentLevel()`**: edge cases (zero indent, odd spaces).
- **`resetRefs()` / `nextRef()`**: verify counter behavior and reset.

---

## Priority 3: `src/daemon.ts` (451 lines, 12 tests)

Tests only cover HTTP request detection and `getSocketDir()`. Many exported utility functions are untested.

### Recommended tests

- **`getPortForSession()`**: consistent port hashing, range bounds (49152-65535), different sessions produce different ports.
- **`getSocketPath()`**: Unix vs Windows path logic, session parameter vs default.
- **`getConnectionInfo()`**: correct connection type object per platform.
- **`isDaemonRunning()`**: nonexistent PID file, stale PID, valid PID (mock `process.kill`).
- **`cleanupSocket()`**: removes correct files, handles missing files gracefully.
- **`setSession()` / `getSession()`**: basic state management.
- **`getAppDir()`**: `XDG_RUNTIME_DIR` priority, home directory fallback, tmpdir fallback.

---

## Priority 4: `src/stream-server.ts` (382 lines, 0 tests)

The WebSocket streaming server has zero coverage. This includes security-critical origin verification code.

### Recommended tests

- **`start()` / `stop()` lifecycle**: server starts on correct port and cleans up.
- **Origin verification (`verifyClient`)**: connections without origin are accepted (CLI clients), localhost origins are accepted, foreign origins are rejected. **Security-critical.**
- **Frame broadcasting**: frames are sent to all connected clients.
- **Input event handling**: mouse/keyboard/touch messages are forwarded to browser correctly.
- **Client disconnection**: cleanup when clients disconnect.
- **Status message broadcasting**: status messages sent on connect.

---

## Priority 5: `src/ios-actions.ts` (273 lines, 0 tests)

The iOS command dispatcher mirrors `actions.ts` but for iOS. Zero coverage.

### Recommended tests

- Each action case in `executeIOSCommand()` with a mocked `IOSManager`.
- Correct response shapes (`{ launched: true }`, `{ clicked: true }`, etc.).
- Error handling for unsupported commands.
- Edge cases in the fallback/default case.

---

## Priority 6: `src/ios-manager.ts` (1,299 lines, 10 tests)

Only `listDevices` and `getRefData` are tested. Integration tests are skipped (require Appium + iOS Simulator).

### Recommended tests (with mocked Appium)

- `launch()` / `close()` lifecycle.
- `navigate()`, `click()`, `tap()`, `type()`, `fill()` with mocked WebDriver sessions.
- `screenshot()` and `getSnapshot()` response shapes.
- Error handling when Appium is unavailable.

---

## Infrastructure Recommendations

### 1. Add coverage tooling

Vitest has built-in coverage via `@vitest/coverage-v8`. Add to `vitest.config.ts`:

```ts
coverage: {
  provider: 'v8',
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts'],
  thresholds: { lines: 50 }  // start low, ratchet up
}
```

### 2. Add coverage script

In `package.json`:

```json
"test:coverage": "vitest run --coverage"
```

### 3. CI coverage reporting

Add coverage output to the GitHub Actions workflow so PRs show coverage diffs.

### 4. Coverage thresholds

Start with a baseline (estimated ~30-40% currently) and enforce it never decreases.

---

## Highest-Impact Improvements (by effort-to-value)

1. **`snapshot.ts` unit tests** -- Pure functions, no mocking needed, tests the project's core differentiator.
2. **`actions.ts` `toAIFriendlyError` full branch coverage** -- 4 more test cases to cover all error paths.
3. **`stream-server.ts` origin verification tests** -- Security-critical code with zero coverage.
4. **`daemon.ts` utility function tests** -- Pure/near-pure functions, easy to write.
5. **Coverage tooling setup** -- One-time investment that makes all future gaps visible.
