#!/usr/bin/env node
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { send, setDebug, setSession, getSession } from './client.js';
import type { Response } from './types.js';

/**
 * List all active veb sessions
 */
function listSessions(): string[] {
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    const sessions: string[] = [];
    
    for (const file of files) {
      const match = file.match(/^veb-(.+)\.pid$/);
      if (match) {
        const pidFile = path.join(tmpDir, file);
        try {
          const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
          // Check if process is still running
          process.kill(pid, 0);
          sessions.push(match[1]);
        } catch {
          // Process not running, ignore
        }
      }
    }
    
    return sessions;
  } catch {
    return [];
  }
}

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const c = (color: keyof typeof colors, text: string) => `${colors[color]}${text}${colors.reset}`;

function printHelp(): void {
  console.log(`
${c('bold', 'veb')} - headless browser automation for agents and humans

${c('yellow', 'Usage:')}
  veb <command> [options]

${c('yellow', 'Commands:')}
  ${c('cyan', 'open')} <url>                    Open a URL in the browser
  ${c('cyan', 'click')} <selector>              Click an element
  ${c('cyan', 'dblclick')} <selector>           Double-click an element
  ${c('cyan', 'type')} <selector> <text>        Type text into an element
  ${c('cyan', 'fill')} <selector> <value>       Clear and fill input
  ${c('cyan', 'press')} <key>                   Press a keyboard key
  ${c('cyan', 'check')} <selector>              Check a checkbox/radio
  ${c('cyan', 'uncheck')} <selector>            Uncheck a checkbox
  ${c('cyan', 'select')} <selector> <value>     Select dropdown option
  ${c('cyan', 'hover')} <selector>              Hover over an element
  ${c('cyan', 'focus')} <selector>              Focus an element
  ${c('cyan', 'drag')} <source> <target>        Drag and drop
  ${c('cyan', 'upload')} <selector> <file...>   Upload files
  ${c('cyan', 'wait')} <selector|text|ms>       Wait for element, text, or duration
  ${c('cyan', 'screenshot')} [path]             Take a screenshot
  ${c('cyan', 'pdf')} <path>                    Save page as PDF
  ${c('cyan', 'snapshot')}                      Get accessibility tree (for agents)
  ${c('cyan', 'extract')} <selector>            Extract element content
  ${c('cyan', 'eval')} <script>                 Evaluate JavaScript
  ${c('cyan', 'scroll')} <direction> [amount]   Scroll the page
  ${c('cyan', 'close')}                         Close browser and stop daemon

${c('yellow', 'Locator Commands:')}
  ${c('cyan', 'role')} <role> click|fill|check  Find by ARIA role
  ${c('cyan', 'text')} <text> click|hover       Find by text content
  ${c('cyan', 'label')} <label> click|fill      Find by label
  ${c('cyan', 'placeholder')} <ph> click|fill   Find by placeholder

${c('yellow', 'Frame Commands:')}
  ${c('cyan', 'frame')} <selector>              Switch to iframe
  ${c('cyan', 'mainframe')}                     Switch back to main frame

${c('yellow', 'Cookie Commands:')}
  ${c('cyan', 'cookies')}                       Get all cookies
  ${c('cyan', 'cookies set')} <json>            Set cookies
  ${c('cyan', 'cookies clear')}                 Clear all cookies

${c('yellow', 'Storage Commands:')}
  ${c('cyan', 'storage local')} [key]           Get localStorage
  ${c('cyan', 'storage local set')} <k> <v>     Set localStorage
  ${c('cyan', 'storage local clear')}           Clear localStorage
  ${c('cyan', 'storage session')} [key]         Get sessionStorage
  ${c('cyan', 'storage session set')} <k> <v>   Set sessionStorage
  ${c('cyan', 'storage session clear')}         Clear sessionStorage

${c('yellow', 'Dialog Commands:')}
  ${c('cyan', 'dialog accept')} [text]          Accept next dialog
  ${c('cyan', 'dialog dismiss')}                Dismiss next dialog

${c('yellow', 'Tab/Window Commands:')}
  ${c('cyan', 'tab new')}                       Open a new tab
  ${c('cyan', 'tab list')}                      List all open tabs
  ${c('cyan', 'tab')} <index>                   Switch to tab by index
  ${c('cyan', 'tab close')} [index]             Close tab (current if no index)
  ${c('cyan', 'window new')}                    Open a new window

${c('yellow', 'Session Commands:')}
  ${c('cyan', 'session')}                       Show current session name
  ${c('cyan', 'session list')}                  List all active sessions

${c('yellow', 'Options:')}
  --session <name>              Use isolated browser session (or VEB_SESSION env)
  --json                        Output raw JSON (for agents)
  --selector, -s <sel>          Target specific element
  --text, -t                    Wait for text instead of selector
  --full, -f                    Full page screenshot
  --debug                       Show debug output
  --help, -h                    Show help

${c('yellow', 'Examples:')}
  veb open https://example.com
  veb click "#submit-btn"
  veb type "#email" "hello@example.com"
  veb wait --text "Welcome"
  veb wait 2000
  veb screenshot --full page.png
  veb extract "table" --json
  veb eval "document.title"
  veb scroll down 500
  veb tab new
  veb tab list
  veb tab 0
`);
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function printResponse(response: Response, jsonMode: boolean): void {
  if (jsonMode) {
    console.log(JSON.stringify(response));
    return;
  }
  
  if (!response.success) {
    console.error(c('red', '✗ Error:'), response.error);
    process.exit(1);
  }
  
  const data = response.data as Record<string, unknown>;
  
  // Pretty print based on data type
  if (data.url && data.title) {
    console.log(c('green', '✓'), c('bold', data.title as string));
    console.log(c('dim', `  ${data.url}`));
  } else if (data.html) {
    console.log(data.html);
  } else if (data.snapshot) {
    console.log(data.snapshot);
  } else if (data.result !== undefined) {
    const result = data.result;
    if (typeof result === 'object') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  } else if (data.base64) {
    console.log(c('green', '✓'), 'Screenshot captured (base64)');
    console.log(c('dim', `  ${(data.base64 as string).length} bytes`));
  } else if (data.path) {
    console.log(c('green', '✓'), `Saved to ${data.path}`);
  } else if (data.cookies) {
    // Cookies get
    const cookies = data.cookies as Array<{ name: string; value: string; domain?: string }>;
    if (cookies.length === 0) {
      console.log(c('dim', 'No cookies'));
    } else {
      cookies.forEach(cookie => {
        console.log(`${c('cyan', cookie.name)}: ${cookie.value}`);
        if (cookie.domain) console.log(c('dim', `  domain: ${cookie.domain}`));
      });
    }
  } else if (data.data) {
    // Storage get (all)
    const storage = data.data as Record<string, string>;
    const keys = Object.keys(storage);
    if (keys.length === 0) {
      console.log(c('dim', 'Empty storage'));
    } else {
      keys.forEach(key => {
        console.log(`${c('cyan', key)}: ${storage[key]}`);
      });
    }
  } else if (data.value !== undefined && data.key) {
    // Storage get (single key)
    console.log(data.value ?? c('dim', 'null'));
  } else if (data.uploaded) {
    const files = data.uploaded as string[];
    console.log(c('green', '✓'), `Uploaded ${files.length} file(s)`);
  } else if (data.handler) {
    console.log(c('green', '✓'), `Dialog handler set to ${data.response}`);
  } else if (data.clicked || data.typed || data.pressed || data.hovered || data.scrolled || data.selected || data.waited || data.filled || data.checked || data.unchecked || data.focused || data.dragged || data.switched || data.set || data.cleared) {
    console.log(c('green', '✓'), 'Done');
  } else if (data.launched) {
    console.log(c('green', '✓'), 'Browser launched');
  } else if (data.closed === true) {
    console.log(c('green', '✓'), 'Browser closed');
  } else if (data.tabs) {
    // Tab list
    const tabs = data.tabs as Array<{ index: number; url: string; title: string; active: boolean }>;
    tabs.forEach(tab => {
      const marker = tab.active ? c('green', '→') : ' ';
      const idx = c('cyan', `[${tab.index}]`);
      const title = tab.title || c('dim', '(untitled)');
      console.log(`${marker} ${idx} ${title}`);
      if (tab.url) console.log(c('dim', `     ${tab.url}`));
    });
  } else if (data.index !== undefined && data.total !== undefined) {
    // Tab new / window new
    console.log(c('green', '✓'), `Tab ${data.index} created (${data.total} total)`);
  } else if (data.remaining !== undefined) {
    // Tab close
    console.log(c('green', '✓'), `Tab closed (${data.remaining} remaining)`);
  } else {
    console.log(c('green', '✓'), JSON.stringify(data));
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Enable debug mode early
  const debugMode = args.includes('--debug');
  if (debugMode) {
    setDebug(true);
  }
  
  // Handle session - check --session flag first, then env var
  const sessionIdx = args.findIndex(a => a === '--session');
  if (sessionIdx !== -1 && args[sessionIdx + 1]) {
    setSession(args[sessionIdx + 1]);
  }
  // VEB_SESSION env var is already handled by daemon.ts default
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  
  const jsonMode = args.includes('--json');
  const fullPage = args.includes('--full') || args.includes('-f');
  const textMode = args.includes('--text') || args.includes('-t');
  
  // Remove flag args and their values
  const cleanArgs = args.filter((a, i) => {
    if (a.startsWith('-')) return false;
    // Check if previous arg was a flag that takes a value
    const prev = args[i - 1];
    if (prev === '--selector' || prev === '-s') return false;
    if (prev === '--session') return false;
    if (prev === '--name' || prev === '-n') return false;
    return true;
  });
  const command = cleanArgs[0];
  
  // Find --selector value
  let selectorOverride: string | undefined;
  const sIdx = args.findIndex(a => a === '--selector' || a === '-s');
  if (sIdx !== -1 && args[sIdx + 1]) {
    selectorOverride = args[sIdx + 1];
  }
  
  // Find --name value (for locator commands)
  let nameOverride: string | undefined;
  const nIdx = args.findIndex(a => a === '--name' || a === '-n');
  if (nIdx !== -1 && args[nIdx + 1]) {
    nameOverride = args[nIdx + 1];
  }
  
  // Find --exact flag
  const exactMode = args.includes('--exact');
  
  const id = genId();
  let cmd: Record<string, unknown>;
  
  switch (command) {
    case 'open':
    case 'goto':
    case 'navigate': {
      const url = cleanArgs[1];
      if (!url) {
        console.error(c('red', 'Error:'), 'URL required');
        process.exit(1);
      }
      // Auto-add https if missing
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      cmd = { id, action: 'navigate', url: fullUrl };
      break;
    }
    
    case 'click': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'click', selector };
      break;
    }
    
    case 'type': {
      const selector = cleanArgs[1];
      const text = cleanArgs.slice(2).join(' ');
      if (!selector || !text) {
        console.error(c('red', 'Error:'), 'Selector and text required');
        process.exit(1);
      }
      cmd = { id, action: 'type', selector, text, clear: true };
      break;
    }
    
    case 'fill': {
      const selector = cleanArgs[1];
      const value = cleanArgs.slice(2).join(' ');
      if (!selector || value === undefined) {
        console.error(c('red', 'Error:'), 'Selector and value required');
        process.exit(1);
      }
      cmd = { id, action: 'fill', selector, value };
      break;
    }
    
    case 'check': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'check', selector };
      break;
    }
    
    case 'uncheck': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'uncheck', selector };
      break;
    }
    
    case 'dblclick':
    case 'doubleclick': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'dblclick', selector };
      break;
    }
    
    case 'focus': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'focus', selector };
      break;
    }
    
    case 'drag': {
      const source = cleanArgs[1];
      const target = cleanArgs[2];
      if (!source || !target) {
        console.error(c('red', 'Error:'), 'Source and target selectors required');
        process.exit(1);
      }
      cmd = { id, action: 'drag', source, target };
      break;
    }
    
    case 'upload': {
      const selector = cleanArgs[1];
      const files = cleanArgs.slice(2);
      if (!selector || files.length === 0) {
        console.error(c('red', 'Error:'), 'Selector and file(s) required');
        process.exit(1);
      }
      cmd = { id, action: 'upload', selector, files };
      break;
    }
    
    case 'press': {
      const key = cleanArgs[1];
      if (!key) {
        console.error(c('red', 'Error:'), 'Key required');
        process.exit(1);
      }
      cmd = { id, action: 'press', key, selector: selectorOverride };
      break;
    }
    
    case 'wait': {
      const target = cleanArgs[1];
      if (!target) {
        console.error(c('red', 'Error:'), 'Selector, text, or milliseconds required');
        process.exit(1);
      }
      
      // Check if it's a number (milliseconds)
      const ms = parseInt(target, 10);
      if (!isNaN(ms)) {
        cmd = { id, action: 'wait', timeout: ms };
      } else if (textMode) {
        // Wait for text - use evaluate to check for text
        cmd = { id, action: 'wait', selector: `text=${target}` };
      } else {
        cmd = { id, action: 'wait', selector: target };
      }
      break;
    }
    
    case 'screenshot':
    case 'ss': {
      const pathArg = cleanArgs[1];
      cmd = { 
        id, 
        action: 'screenshot', 
        path: pathArg,
        fullPage,
        selector: selectorOverride,
      };
      break;
    }
    
    case 'snapshot':
    case 'aria':
    case 'a11y': {
      cmd = { id, action: 'snapshot' };
      break;
    }
    
    case 'extract':
    case 'html':
    case 'content': {
      const selector = cleanArgs[1] || selectorOverride;
      cmd = { id, action: 'content', selector };
      break;
    }
    
    case 'eval':
    case 'js': {
      const script = cleanArgs.slice(1).join(' ');
      if (!script) {
        console.error(c('red', 'Error:'), 'Script required');
        process.exit(1);
      }
      cmd = { id, action: 'evaluate', script };
      break;
    }
    
    case 'scroll': {
      const dirOrAmount = cleanArgs[1];
      const amount = parseInt(cleanArgs[2], 10) || 300;
      
      if (['up', 'down', 'left', 'right'].includes(dirOrAmount)) {
        cmd = { id, action: 'scroll', direction: dirOrAmount, amount, selector: selectorOverride };
      } else {
        const y = parseInt(dirOrAmount, 10) || 300;
        cmd = { id, action: 'scroll', y, selector: selectorOverride };
      }
      break;
    }
    
    case 'hover': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Selector required');
        process.exit(1);
      }
      cmd = { id, action: 'hover', selector };
      break;
    }
    
    case 'select': {
      const selector = cleanArgs[1];
      const value = cleanArgs[2];
      if (!selector || !value) {
        console.error(c('red', 'Error:'), 'Selector and value required');
        process.exit(1);
      }
      cmd = { id, action: 'select', selector, values: value };
      break;
    }
    
    case 'pdf': {
      const pdfPath = cleanArgs[1];
      if (!pdfPath) {
        console.error(c('red', 'Error:'), 'Path required');
        process.exit(1);
      }
      cmd = { id, action: 'pdf', path: pdfPath };
      break;
    }
    
    case 'frame': {
      const selector = cleanArgs[1];
      if (!selector) {
        console.error(c('red', 'Error:'), 'Frame selector required');
        process.exit(1);
      }
      cmd = { id, action: 'frame', selector };
      break;
    }
    
    case 'mainframe': {
      cmd = { id, action: 'mainframe' };
      break;
    }
    
    case 'role': {
      const role = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'fill' | 'check' | 'hover';
      const value = cleanArgs[3];
      if (!role || !subaction) {
        console.error(c('red', 'Error:'), 'Role and action required (e.g., veb role button click --name "Submit")');
        process.exit(1);
      }
      cmd = { id, action: 'getbyrole', role, name: nameOverride, subaction, value };
      break;
    }
    
    case 'text': {
      const text = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'hover';
      if (!text || !subaction) {
        console.error(c('red', 'Error:'), 'Text and action required (e.g., veb text "Submit" click)');
        process.exit(1);
      }
      cmd = { id, action: 'getbytext', text, exact: exactMode, subaction };
      break;
    }
    
    case 'label': {
      const label = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'fill' | 'check';
      const value = cleanArgs[3];
      if (!label || !subaction) {
        console.error(c('red', 'Error:'), 'Label and action required (e.g., veb label "Email" fill "test@test.com")');
        process.exit(1);
      }
      cmd = { id, action: 'getbylabel', label, subaction, value };
      break;
    }
    
    case 'placeholder': {
      const placeholder = cleanArgs[1];
      const subaction = cleanArgs[2] as 'click' | 'fill';
      const value = cleanArgs[3];
      if (!placeholder || !subaction) {
        console.error(c('red', 'Error:'), 'Placeholder and action required');
        process.exit(1);
      }
      cmd = { id, action: 'getbyplaceholder', placeholder, subaction, value };
      break;
    }
    
    case 'cookies': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'set') {
        const jsonStr = cleanArgs.slice(2).join(' ');
        try {
          const cookies = JSON.parse(jsonStr);
          cmd = { id, action: 'cookies_set', cookies: Array.isArray(cookies) ? cookies : [cookies] };
        } catch {
          console.error(c('red', 'Error:'), 'Invalid JSON for cookies');
          process.exit(1);
        }
      } else if (subCmd === 'clear') {
        cmd = { id, action: 'cookies_clear' };
      } else {
        cmd = { id, action: 'cookies_get' };
      }
      break;
    }
    
    case 'storage': {
      const storageType = cleanArgs[1]; // 'local' or 'session'
      const subCmd = cleanArgs[2];
      
      if (storageType !== 'local' && storageType !== 'session') {
        console.error(c('red', 'Error:'), 'Storage type must be "local" or "session"');
        process.exit(1);
      }
      
      if (subCmd === 'set') {
        const key = cleanArgs[3];
        const value = cleanArgs.slice(4).join(' ');
        if (!key) {
          console.error(c('red', 'Error:'), 'Key required');
          process.exit(1);
        }
        cmd = { id, action: 'storage_set', type: storageType, key, value };
      } else if (subCmd === 'clear') {
        cmd = { id, action: 'storage_clear', type: storageType };
      } else {
        // Get - subCmd might be a key or undefined
        cmd = { id, action: 'storage_get', type: storageType, key: subCmd };
      }
      break;
    }
    
    case 'dialog': {
      const response = cleanArgs[1];
      const promptText = cleanArgs[2];
      
      if (response !== 'accept' && response !== 'dismiss') {
        console.error(c('red', 'Error:'), 'Dialog response must be "accept" or "dismiss"');
        process.exit(1);
      }
      cmd = { id, action: 'dialog', response, promptText };
      break;
    }
    
    case 'close':
    case 'quit':
    case 'exit': {
      cmd = { id, action: 'close' };
      break;
    }
    
    case 'tab': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'new') {
        cmd = { id, action: 'tab_new' };
      } else if (subCmd === 'list' || subCmd === 'ls') {
        cmd = { id, action: 'tab_list' };
      } else if (subCmd === 'close') {
        const tabIndex = cleanArgs[2] !== undefined ? parseInt(cleanArgs[2], 10) : undefined;
        cmd = { id, action: 'tab_close', index: tabIndex };
      } else if (subCmd !== undefined) {
        // Assume it's a tab index to switch to
        const tabIndex = parseInt(subCmd, 10);
        if (isNaN(tabIndex)) {
          console.error(c('red', 'Error:'), `Invalid tab command or index: ${subCmd}`);
          process.exit(1);
        }
        cmd = { id, action: 'tab_switch', index: tabIndex };
      } else {
        // No subcommand - list tabs
        cmd = { id, action: 'tab_list' };
      }
      break;
    }
    
    case 'window': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'new') {
        cmd = { id, action: 'window_new' };
      } else {
        console.error(c('red', 'Error:'), 'Usage: veb window new');
        process.exit(1);
      }
      break;
    }
    
    case 'session': {
      const subCmd = cleanArgs[1];
      
      if (subCmd === 'list' || subCmd === 'ls') {
        const sessions = listSessions();
        const currentSession = getSession();
        
        if (sessions.length === 0) {
          console.log(c('dim', 'No active sessions'));
        } else {
          sessions.forEach(sess => {
            const marker = sess === currentSession ? c('green', '→') : ' ';
            console.log(`${marker} ${c('cyan', sess)}`);
          });
        }
        process.exit(0);
      } else {
        // Show current session
        console.log(c('cyan', getSession()));
        process.exit(0);
      }
    }
    
    default:
      console.error(c('red', 'Error:'), `Unknown command: ${command}`);
      console.error(c('dim', 'Run veb --help for usage'));
      process.exit(1);
  }
  
  try {
    const response = await send(cmd);
    printResponse(response, jsonMode);
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      console.log(JSON.stringify({ id, success: false, error: message }));
    } else {
      console.error(c('red', '✗ Error:'), message);
    }
    process.exit(1);
  }
}

main();
