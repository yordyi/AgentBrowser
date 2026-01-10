import type { Page, Browser, BrowserContext } from 'playwright';

// Base command structure
export interface BaseCommand {
  id: string;
  action: string;
}

// Action-specific command types
export interface LaunchCommand extends BaseCommand {
  action: 'launch';
  headless?: boolean;
  viewport?: { width: number; height: number };
  browser?: 'chromium' | 'firefox' | 'webkit';
}

export interface NavigateCommand extends BaseCommand {
  action: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface ClickCommand extends BaseCommand {
  action: 'click';
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

export interface TypeCommand extends BaseCommand {
  action: 'type';
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface FillCommand extends BaseCommand {
  action: 'fill';
  selector: string;
  value: string;
}

export interface CheckCommand extends BaseCommand {
  action: 'check';
  selector: string;
}

export interface UncheckCommand extends BaseCommand {
  action: 'uncheck';
  selector: string;
}

export interface UploadCommand extends BaseCommand {
  action: 'upload';
  selector: string;
  files: string | string[];
}

export interface DoubleClickCommand extends BaseCommand {
  action: 'dblclick';
  selector: string;
}

export interface FocusCommand extends BaseCommand {
  action: 'focus';
  selector: string;
}

export interface DragCommand extends BaseCommand {
  action: 'drag';
  source: string;
  target: string;
}

export interface FrameCommand extends BaseCommand {
  action: 'frame';
  selector?: string;
  name?: string;
  url?: string;
}

export interface MainFrameCommand extends BaseCommand {
  action: 'mainframe';
}

export interface GetByRoleCommand extends BaseCommand {
  action: 'getbyrole';
  role: string;
  name?: string;
  subaction: 'click' | 'fill' | 'check' | 'hover';
  value?: string;
}

export interface GetByTextCommand extends BaseCommand {
  action: 'getbytext';
  text: string;
  exact?: boolean;
  subaction: 'click' | 'hover';
}

export interface GetByLabelCommand extends BaseCommand {
  action: 'getbylabel';
  label: string;
  subaction: 'click' | 'fill' | 'check';
  value?: string;
}

export interface GetByPlaceholderCommand extends BaseCommand {
  action: 'getbyplaceholder';
  placeholder: string;
  subaction: 'click' | 'fill';
  value?: string;
}

export interface CookiesGetCommand extends BaseCommand {
  action: 'cookies_get';
  urls?: string[];
}

export interface CookiesSetCommand extends BaseCommand {
  action: 'cookies_set';
  cookies: Array<{
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
}

export interface CookiesClearCommand extends BaseCommand {
  action: 'cookies_clear';
}

export interface StorageGetCommand extends BaseCommand {
  action: 'storage_get';
  key?: string;
  type: 'local' | 'session';
}

export interface StorageSetCommand extends BaseCommand {
  action: 'storage_set';
  key: string;
  value: string;
  type: 'local' | 'session';
}

export interface StorageClearCommand extends BaseCommand {
  action: 'storage_clear';
  type: 'local' | 'session';
}

export interface DialogCommand extends BaseCommand {
  action: 'dialog';
  response: 'accept' | 'dismiss';
  promptText?: string;
}

export interface PdfCommand extends BaseCommand {
  action: 'pdf';
  path: string;
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
}

export interface PressCommand extends BaseCommand {
  action: 'press';
  key: string;
  selector?: string;
}

export interface ScreenshotCommand extends BaseCommand {
  action: 'screenshot';
  path?: string;
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface SnapshotCommand extends BaseCommand {
  action: 'snapshot';
}

export interface EvaluateCommand extends BaseCommand {
  action: 'evaluate';
  script: string;
  args?: unknown[];
}

export interface WaitCommand extends BaseCommand {
  action: 'wait';
  selector?: string;
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface ScrollCommand extends BaseCommand {
  action: 'scroll';
  selector?: string;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface SelectCommand extends BaseCommand {
  action: 'select';
  selector: string;
  values: string | string[];
}

export interface HoverCommand extends BaseCommand {
  action: 'hover';
  selector: string;
}

export interface ContentCommand extends BaseCommand {
  action: 'content';
  selector?: string;
}

export interface CloseCommand extends BaseCommand {
  action: 'close';
}

// Tab/Window commands
export interface TabNewCommand extends BaseCommand {
  action: 'tab_new';
}

export interface TabListCommand extends BaseCommand {
  action: 'tab_list';
}

export interface TabSwitchCommand extends BaseCommand {
  action: 'tab_switch';
  index: number;
}

export interface TabCloseCommand extends BaseCommand {
  action: 'tab_close';
  index?: number;
}

export interface WindowNewCommand extends BaseCommand {
  action: 'window_new';
  viewport?: { width: number; height: number };
}

// Union of all command types
export type Command =
  | LaunchCommand
  | NavigateCommand
  | ClickCommand
  | TypeCommand
  | FillCommand
  | CheckCommand
  | UncheckCommand
  | UploadCommand
  | DoubleClickCommand
  | FocusCommand
  | DragCommand
  | FrameCommand
  | MainFrameCommand
  | GetByRoleCommand
  | GetByTextCommand
  | GetByLabelCommand
  | GetByPlaceholderCommand
  | PressCommand
  | ScreenshotCommand
  | SnapshotCommand
  | EvaluateCommand
  | WaitCommand
  | ScrollCommand
  | SelectCommand
  | HoverCommand
  | ContentCommand
  | CloseCommand
  | TabNewCommand
  | TabListCommand
  | TabSwitchCommand
  | TabCloseCommand
  | WindowNewCommand
  | CookiesGetCommand
  | CookiesSetCommand
  | CookiesClearCommand
  | StorageGetCommand
  | StorageSetCommand
  | StorageClearCommand
  | DialogCommand
  | PdfCommand;

// Response types
export interface SuccessResponse<T = unknown> {
  id: string;
  success: true;
  data: T;
}

export interface ErrorResponse {
  id: string;
  success: false;
  error: string;
}

export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Data types for specific responses
export interface NavigateData {
  url: string;
  title: string;
}

export interface ScreenshotData {
  path?: string;
  base64?: string;
}

export interface SnapshotData {
  snapshot: string;
}

export interface EvaluateData {
  result: unknown;
}

export interface ContentData {
  html: string;
}

export interface TabInfo {
  index: number;
  url: string;
  title: string;
  active: boolean;
}

export interface TabListData {
  tabs: TabInfo[];
  active: number;
}

export interface TabNewData {
  index: number;
  total: number;
}

export interface TabSwitchData {
  index: number;
  url: string;
  title: string;
}

export interface TabCloseData {
  closed: number;
  remaining: number;
}

// Browser state
export interface BrowserState {
  browser: Browser | null;
  context: BrowserContext | null;
  page: Page | null;
}
