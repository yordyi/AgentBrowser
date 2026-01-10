# veb

Headless browser automation CLI for agents and humans. Near-complete Playwright parity.

## Installation

```bash
pnpm install
npx playwright install chromium
pnpm build
```

## Usage

```bash
# Navigation
veb open https://example.com

# Clicking
veb click "#submit-btn"
veb dblclick "#item"

# Form input
veb type "#search" "query"           # Type character by character
veb fill "#email" "test@example.com" # Clear and fill (faster)
veb check "#agree"                   # Check checkbox/radio
veb uncheck "#newsletter"            # Uncheck checkbox
veb select "#country" "US"           # Select dropdown

# Keyboard
veb press Enter
veb press Tab

# Mouse
veb hover "#menu"
veb focus "#input"
veb drag "#source" "#target"

# File upload
veb upload "#file-input" ./document.pdf
veb upload "#files" ./a.png ./b.png

# Waiting
veb wait "#loading"              # Wait for selector
veb wait --text "Welcome"        # Wait for text
veb wait 2000                    # Wait 2 seconds

# Screenshots & PDF
veb screenshot page.png
veb screenshot --full page.png   # Full page
veb screenshot -s "#hero"        # Specific element
veb pdf report.pdf

# Content extraction
veb snapshot                     # Accessibility tree (best for agents)
veb extract "#main"              # Get HTML
veb eval "document.title"        # Run JavaScript

# Scrolling
veb scroll down 500
veb scroll up
veb scroll -s "#container" down

# Semantic locators (Playwright's recommended approach)
veb role button click --name "Submit"
veb role textbox fill "hello" --name "Email"
veb text "Sign In" click
veb text "Submit" click --exact
veb label "Email" fill "test@test.com"
veb placeholder "Search..." fill "query"

# Frames/iframes
veb frame "#iframe"              # Switch to iframe
veb mainframe                    # Switch back to main

# Cookies
veb cookies                      # Get all cookies
veb cookies set '[{"name":"session","value":"abc123","domain":".example.com"}]'
veb cookies clear

# Storage
veb storage local                # Get all localStorage
veb storage local myKey          # Get specific key
veb storage local set key value  # Set value
veb storage local clear          # Clear localStorage
veb storage session              # sessionStorage (same commands)

# Dialogs (alerts, confirms, prompts)
veb dialog accept                # Accept next dialog
veb dialog accept "input text"   # Accept prompt with text
veb dialog dismiss               # Dismiss next dialog

# Tabs
veb tab new
veb tab list
veb tab 0                        # Switch to tab
veb tab close

# Windows
veb window new

# Sessions (isolate multiple agents)
veb --session agent1 open example.com
veb --session agent2 open google.com
VEB_SESSION=agent1 veb click "#btn"
veb session list

# Close browser
veb close
```

## Agent Mode

Use `--json` flag for machine-readable output:

```bash
veb snapshot --json
veb eval "document.title" --json
```

## Commands Reference

### Navigation & Interaction
| Command | Description |
|---------|-------------|
| `open <url>` | Navigate to URL |
| `click <selector>` | Click element |
| `dblclick <selector>` | Double-click |
| `type <selector> <text>` | Type text |
| `fill <selector> <value>` | Clear & fill |
| `press <key>` | Press key |
| `check <selector>` | Check checkbox |
| `uncheck <selector>` | Uncheck |
| `select <selector> <value>` | Select option |
| `hover <selector>` | Hover |
| `focus <selector>` | Focus |
| `drag <src> <target>` | Drag & drop |
| `upload <selector> <files>` | Upload files |
| `scroll <dir> [amount]` | Scroll |

### Semantic Locators
| Command | Description |
|---------|-------------|
| `role <role> <action>` | By ARIA role |
| `text <text> <action>` | By text |
| `label <label> <action>` | By label |
| `placeholder <ph> <action>` | By placeholder |

### Content & Screenshots
| Command | Description |
|---------|-------------|
| `screenshot [path]` | Screenshot |
| `pdf <path>` | Save as PDF |
| `snapshot` | Accessibility tree |
| `extract <selector>` | Get HTML |
| `eval <script>` | Run JavaScript |

### Browser State
| Command | Description |
|---------|-------------|
| `cookies` | Get cookies |
| `cookies set <json>` | Set cookies |
| `cookies clear` | Clear cookies |
| `storage local [key]` | Get localStorage |
| `storage local set <k> <v>` | Set localStorage |
| `storage local clear` | Clear localStorage |
| `dialog accept [text]` | Accept dialog |
| `dialog dismiss` | Dismiss dialog |

### Frames & Tabs
| Command | Description |
|---------|-------------|
| `frame <selector>` | Switch to frame |
| `mainframe` | Back to main |
| `tab new` | New tab |
| `tab list` | List tabs |
| `tab <index>` | Switch tab |
| `tab close [index]` | Close tab |
| `window new` | New window |

### Session & Control
| Command | Description |
|---------|-------------|
| `wait <sel\|text\|ms>` | Wait for condition |
| `session` | Show session |
| `session list` | List sessions |
| `close` | Close browser |

## Options

| Option | Description |
|--------|-------------|
| `--session <name>` | Use isolated session |
| `--json` | JSON output |
| `--full, -f` | Full page screenshot |
| `--selector, -s` | Target element |
| `--name, -n` | Locator name filter |
| `--exact` | Exact text match |
| `--text, -t` | Wait for text |
| `--debug` | Debug output |

## Selectors

veb supports all Playwright selectors:

```bash
# CSS
veb click "#id"
veb click ".class"
veb click "div.container > button"

# Text
veb click "text=Click me"

# XPath
veb click "xpath=//button[@type='submit']"

# Semantic (recommended)
veb role button click --name "Submit"
veb label "Email" fill "test@test.com"
```

## License

MIT
