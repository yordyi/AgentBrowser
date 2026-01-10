import type { Page, Frame } from 'playwright';
import type { BrowserManager } from './browser.js';
import type {
  Command,
  Response,
  NavigateCommand,
  ClickCommand,
  TypeCommand,
  FillCommand,
  CheckCommand,
  UncheckCommand,
  UploadCommand,
  DoubleClickCommand,
  FocusCommand,
  DragCommand,
  FrameCommand,
  GetByRoleCommand,
  GetByTextCommand,
  GetByLabelCommand,
  GetByPlaceholderCommand,
  PressCommand,
  ScreenshotCommand,
  EvaluateCommand,
  WaitCommand,
  ScrollCommand,
  SelectCommand,
  HoverCommand,
  ContentCommand,
  TabSwitchCommand,
  TabCloseCommand,
  WindowNewCommand,
  CookiesSetCommand,
  StorageGetCommand,
  StorageSetCommand,
  StorageClearCommand,
  DialogCommand,
  PdfCommand,
  NavigateData,
  ScreenshotData,
  EvaluateData,
  ContentData,
  TabListData,
  TabNewData,
  TabSwitchData,
  TabCloseData,
} from './types.js';
import { successResponse, errorResponse } from './protocol.js';

// Snapshot response type
interface SnapshotData {
  snapshot: string;
}

/**
 * Execute a command and return a response
 */
export async function executeCommand(
  command: Command,
  browser: BrowserManager
): Promise<Response> {
  try {
    switch (command.action) {
      case 'launch':
        return await handleLaunch(command, browser);
      case 'navigate':
        return await handleNavigate(command, browser);
      case 'click':
        return await handleClick(command, browser);
      case 'type':
        return await handleType(command, browser);
      case 'fill':
        return await handleFill(command, browser);
      case 'check':
        return await handleCheck(command, browser);
      case 'uncheck':
        return await handleUncheck(command, browser);
      case 'upload':
        return await handleUpload(command, browser);
      case 'dblclick':
        return await handleDoubleClick(command, browser);
      case 'focus':
        return await handleFocus(command, browser);
      case 'drag':
        return await handleDrag(command, browser);
      case 'frame':
        return await handleFrame(command, browser);
      case 'mainframe':
        return await handleMainFrame(command, browser);
      case 'getbyrole':
        return await handleGetByRole(command, browser);
      case 'getbytext':
        return await handleGetByText(command, browser);
      case 'getbylabel':
        return await handleGetByLabel(command, browser);
      case 'getbyplaceholder':
        return await handleGetByPlaceholder(command, browser);
      case 'press':
        return await handlePress(command, browser);
      case 'screenshot':
        return await handleScreenshot(command, browser);
      case 'snapshot':
        return await handleSnapshot(command, browser);
      case 'evaluate':
        return await handleEvaluate(command, browser);
      case 'wait':
        return await handleWait(command, browser);
      case 'scroll':
        return await handleScroll(command, browser);
      case 'select':
        return await handleSelect(command, browser);
      case 'hover':
        return await handleHover(command, browser);
      case 'content':
        return await handleContent(command, browser);
      case 'close':
        return await handleClose(command, browser);
      case 'tab_new':
        return await handleTabNew(command, browser);
      case 'tab_list':
        return await handleTabList(command, browser);
      case 'tab_switch':
        return await handleTabSwitch(command, browser);
      case 'tab_close':
        return await handleTabClose(command, browser);
      case 'window_new':
        return await handleWindowNew(command, browser);
      case 'cookies_get':
        return await handleCookiesGet(command, browser);
      case 'cookies_set':
        return await handleCookiesSet(command, browser);
      case 'cookies_clear':
        return await handleCookiesClear(command, browser);
      case 'storage_get':
        return await handleStorageGet(command, browser);
      case 'storage_set':
        return await handleStorageSet(command, browser);
      case 'storage_clear':
        return await handleStorageClear(command, browser);
      case 'dialog':
        return await handleDialog(command, browser);
      case 'pdf':
        return await handlePdf(command, browser);
      default: {
        // TypeScript narrows to never here, but we handle it for safety
        const unknownCommand = command as { id: string; action: string };
        return errorResponse(unknownCommand.id, `Unknown action: ${unknownCommand.action}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

async function handleLaunch(
  command: Command & { action: 'launch' },
  browser: BrowserManager
): Promise<Response> {
  await browser.launch(command);
  return successResponse(command.id, { launched: true });
}

async function handleNavigate(
  command: NavigateCommand,
  browser: BrowserManager
): Promise<Response<NavigateData>> {
  const page = browser.getPage();
  await page.goto(command.url, {
    waitUntil: command.waitUntil ?? 'load',
  });
  
  return successResponse(command.id, {
    url: page.url(),
    title: await page.title(),
  });
}

async function handleClick(
  command: ClickCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.click(command.selector, {
    button: command.button,
    clickCount: command.clickCount,
    delay: command.delay,
  });
  
  return successResponse(command.id, { clicked: true });
}

async function handleType(
  command: TypeCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  
  if (command.clear) {
    await page.fill(command.selector, '');
  }
  
  await page.type(command.selector, command.text, {
    delay: command.delay,
  });
  
  return successResponse(command.id, { typed: true });
}

async function handlePress(
  command: PressCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  
  if (command.selector) {
    await page.press(command.selector, command.key);
  } else {
    await page.keyboard.press(command.key);
  }
  
  return successResponse(command.id, { pressed: true });
}

async function handleScreenshot(
  command: ScreenshotCommand,
  browser: BrowserManager
): Promise<Response<ScreenshotData>> {
  const page = browser.getPage();
  
  const options: Parameters<Page['screenshot']>[0] = {
    fullPage: command.fullPage,
    type: command.format ?? 'png',
  };
  
  if (command.format === 'jpeg' && command.quality !== undefined) {
    options.quality = command.quality;
  }
  
  let target: Page | ReturnType<Page['locator']> = page;
  if (command.selector) {
    target = page.locator(command.selector);
  }
  
  if (command.path) {
    await target.screenshot({ ...options, path: command.path });
    return successResponse(command.id, { path: command.path });
  } else {
    const buffer = await target.screenshot(options);
    return successResponse(command.id, { base64: buffer.toString('base64') });
  }
}

async function handleSnapshot(
  command: Command & { action: 'snapshot' },
  browser: BrowserManager
): Promise<Response<SnapshotData>> {
  const page = browser.getPage();
  // Use ariaSnapshot which returns a string representation of the accessibility tree
  const snapshot = await page.locator(':root').ariaSnapshot();
  
  return successResponse(command.id, {
    snapshot: snapshot ?? 'Empty page',
  });
}

async function handleEvaluate(
  command: EvaluateCommand,
  browser: BrowserManager
): Promise<Response<EvaluateData>> {
  const page = browser.getPage();
  
  // Evaluate the script directly as a string expression
  const result = await page.evaluate(command.script);
  
  return successResponse(command.id, { result });
}

async function handleWait(
  command: WaitCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  
  if (command.selector) {
    await page.waitForSelector(command.selector, {
      state: command.state ?? 'visible',
      timeout: command.timeout,
    });
  } else if (command.timeout) {
    await page.waitForTimeout(command.timeout);
  } else {
    // Default: wait for load state
    await page.waitForLoadState('load');
  }
  
  return successResponse(command.id, { waited: true });
}

async function handleScroll(
  command: ScrollCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  
  if (command.selector) {
    const element = page.locator(command.selector);
    await element.scrollIntoViewIfNeeded();
    
    if (command.x !== undefined || command.y !== undefined) {
      await element.evaluate((el, { x, y }) => {
        el.scrollBy(x ?? 0, y ?? 0);
      }, { x: command.x, y: command.y });
    }
  } else {
    // Scroll the page
    let deltaX = command.x ?? 0;
    let deltaY = command.y ?? 0;
    
    if (command.direction) {
      const amount = command.amount ?? 100;
      switch (command.direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }
    }
    
    await page.evaluate(`window.scrollBy(${deltaX}, ${deltaY})`);
  }
  
  return successResponse(command.id, { scrolled: true });
}

async function handleSelect(
  command: SelectCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const values = Array.isArray(command.values) ? command.values : [command.values];
  
  await page.selectOption(command.selector, values);
  
  return successResponse(command.id, { selected: values });
}

async function handleHover(
  command: HoverCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.hover(command.selector);
  
  return successResponse(command.id, { hovered: true });
}

async function handleContent(
  command: ContentCommand,
  browser: BrowserManager
): Promise<Response<ContentData>> {
  const page = browser.getPage();
  
  let html: string;
  if (command.selector) {
    html = await page.locator(command.selector).innerHTML();
  } else {
    html = await page.content();
  }
  
  return successResponse(command.id, { html });
}

async function handleClose(
  command: Command & { action: 'close' },
  browser: BrowserManager
): Promise<Response> {
  await browser.close();
  return successResponse(command.id, { closed: true });
}

async function handleTabNew(
  command: Command & { action: 'tab_new' },
  browser: BrowserManager
): Promise<Response<TabNewData>> {
  const result = await browser.newTab();
  return successResponse(command.id, result);
}

async function handleTabList(
  command: Command & { action: 'tab_list' },
  browser: BrowserManager
): Promise<Response<TabListData>> {
  const tabs = await browser.listTabs();
  return successResponse(command.id, {
    tabs,
    active: browser.getActiveIndex(),
  });
}

async function handleTabSwitch(
  command: TabSwitchCommand,
  browser: BrowserManager
): Promise<Response<TabSwitchData>> {
  const result = browser.switchTo(command.index);
  const page = browser.getPage();
  return successResponse(command.id, {
    ...result,
    title: await page.title(),
  });
}

async function handleTabClose(
  command: TabCloseCommand,
  browser: BrowserManager
): Promise<Response<TabCloseData>> {
  const result = await browser.closeTab(command.index);
  return successResponse(command.id, result);
}

async function handleWindowNew(
  command: WindowNewCommand,
  browser: BrowserManager
): Promise<Response<TabNewData>> {
  const result = await browser.newWindow(command.viewport);
  return successResponse(command.id, result);
}

// New handlers for enhanced Playwright parity

async function handleFill(
  command: FillCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  await frame.fill(command.selector, command.value);
  return successResponse(command.id, { filled: true });
}

async function handleCheck(
  command: CheckCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  await frame.check(command.selector);
  return successResponse(command.id, { checked: true });
}

async function handleUncheck(
  command: UncheckCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  await frame.uncheck(command.selector);
  return successResponse(command.id, { unchecked: true });
}

async function handleUpload(
  command: UploadCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  const files = Array.isArray(command.files) ? command.files : [command.files];
  await frame.setInputFiles(command.selector, files);
  return successResponse(command.id, { uploaded: files });
}

async function handleDoubleClick(
  command: DoubleClickCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  await frame.dblclick(command.selector);
  return successResponse(command.id, { clicked: true });
}

async function handleFocus(
  command: FocusCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  await frame.focus(command.selector);
  return successResponse(command.id, { focused: true });
}

async function handleDrag(
  command: DragCommand,
  browser: BrowserManager
): Promise<Response> {
  const frame = browser.getFrame();
  await frame.dragAndDrop(command.source, command.target);
  return successResponse(command.id, { dragged: true });
}

async function handleFrame(
  command: FrameCommand,
  browser: BrowserManager
): Promise<Response> {
  await browser.switchToFrame({
    selector: command.selector,
    name: command.name,
    url: command.url,
  });
  return successResponse(command.id, { switched: true });
}

async function handleMainFrame(
  command: Command & { action: 'mainframe' },
  browser: BrowserManager
): Promise<Response> {
  browser.switchToMainFrame();
  return successResponse(command.id, { switched: true });
}

async function handleGetByRole(
  command: GetByRoleCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const locator = page.getByRole(command.role as any, { name: command.name });
  
  switch (command.subaction) {
    case 'click':
      await locator.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      await locator.fill(command.value ?? '');
      return successResponse(command.id, { filled: true });
    case 'check':
      await locator.check();
      return successResponse(command.id, { checked: true });
    case 'hover':
      await locator.hover();
      return successResponse(command.id, { hovered: true });
  }
}

async function handleGetByText(
  command: GetByTextCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const locator = page.getByText(command.text, { exact: command.exact });
  
  switch (command.subaction) {
    case 'click':
      await locator.click();
      return successResponse(command.id, { clicked: true });
    case 'hover':
      await locator.hover();
      return successResponse(command.id, { hovered: true });
  }
}

async function handleGetByLabel(
  command: GetByLabelCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const locator = page.getByLabel(command.label);
  
  switch (command.subaction) {
    case 'click':
      await locator.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      await locator.fill(command.value ?? '');
      return successResponse(command.id, { filled: true });
    case 'check':
      await locator.check();
      return successResponse(command.id, { checked: true });
  }
}

async function handleGetByPlaceholder(
  command: GetByPlaceholderCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const locator = page.getByPlaceholder(command.placeholder);
  
  switch (command.subaction) {
    case 'click':
      await locator.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      await locator.fill(command.value ?? '');
      return successResponse(command.id, { filled: true });
  }
}

async function handleCookiesGet(
  command: Command & { action: 'cookies_get'; urls?: string[] },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const context = page.context();
  const cookies = await context.cookies(command.urls);
  return successResponse(command.id, { cookies });
}

async function handleCookiesSet(
  command: CookiesSetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const context = page.context();
  await context.addCookies(command.cookies);
  return successResponse(command.id, { set: true });
}

async function handleCookiesClear(
  command: Command & { action: 'cookies_clear' },
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const context = page.context();
  await context.clearCookies();
  return successResponse(command.id, { cleared: true });
}

async function handleStorageGet(
  command: StorageGetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const storageType = command.type === 'local' ? 'localStorage' : 'sessionStorage';
  
  if (command.key) {
    const value = await page.evaluate(
      `${storageType}.getItem(${JSON.stringify(command.key)})`
    );
    return successResponse(command.id, { key: command.key, value });
  } else {
    const data = await page.evaluate(`
      (() => {
        const storage = ${storageType};
        const result = {};
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) result[key] = storage.getItem(key);
        }
        return result;
      })()
    `);
    return successResponse(command.id, { data });
  }
}

async function handleStorageSet(
  command: StorageSetCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const storageType = command.type === 'local' ? 'localStorage' : 'sessionStorage';
  
  await page.evaluate(
    `${storageType}.setItem(${JSON.stringify(command.key)}, ${JSON.stringify(command.value)})`
  );
  return successResponse(command.id, { set: true });
}

async function handleStorageClear(
  command: StorageClearCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  const storageType = command.type === 'local' ? 'localStorage' : 'sessionStorage';
  
  await page.evaluate(`${storageType}.clear()`);
  return successResponse(command.id, { cleared: true });
}

async function handleDialog(
  command: DialogCommand,
  browser: BrowserManager
): Promise<Response> {
  browser.setDialogHandler(command.response, command.promptText);
  return successResponse(command.id, { handler: 'set', response: command.response });
}

async function handlePdf(
  command: PdfCommand,
  browser: BrowserManager
): Promise<Response> {
  const page = browser.getPage();
  await page.pdf({
    path: command.path,
    format: command.format ?? 'Letter',
  });
  return successResponse(command.id, { path: command.path });
}
