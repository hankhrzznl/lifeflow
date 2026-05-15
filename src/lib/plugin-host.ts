import type { PluginRegistry } from "./types";

export interface SecurityAuditEvent {
  timestamp: number;
  pluginId: string;
  type: "scan_blocked" | "scan_warning" | "upload_rejected" | "sandbox_error";
  message: string;
  codeSnippet?: string;
}

export class SecurityAuditLog {
  private static events: SecurityAuditEvent[] = [];
  private static maxEvents = 100;

  static log(event: Omit<SecurityAuditEvent, "timestamp">): void {
    this.events.push({ ...event, timestamp: Date.now() });
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
    console.warn(`[Security] [${event.type}] [Plugin:${event.pluginId}] ${event.message}`);
  }

  static getEvents(pluginId?: string): SecurityAuditEvent[] {
    if (pluginId) return this.events.filter((e) => e.pluginId === pluginId);
    return [...this.events];
  }

  static clear(): void {
    this.events = [];
  }
}

interface SecurityScanResult {
  passed: boolean;
  blocked: boolean;
  warnings: string[];
  blocks: string[];
}

const SECURITY_RULES: { pattern: RegExp; message: string; level: "block" | "warn" }[] = [
  { pattern: /document\s*\.\s*(cookie|domain|write|writeln)/, message: "DOM操作: document cookie/domain/write 被拦截", level: "block" },
  { pattern: /(window|self|parent|top)\s*\.\s*location/, message: "导航劫持: location 访问被拦截", level: "block" },
  { pattern: /eval\s*\(/, message: "动态代码执行: eval() 被拦截", level: "block" },
  { pattern: /new\s+Function\s*\(/, message: "动态代码执行: new Function() 被拦截", level: "block" },
  { pattern: /\.\s*innerHTML\s*=/, message: "XSS风险: innerHTML 赋值被拦截", level: "block" },
  { pattern: /\.\s*outerHTML\s*=/, message: "XSS风险: outerHTML 赋值被拦截", level: "block" },
  { pattern: /document\s*\.\s*createElement\s*\(\s*['"]script['"]/, message: "XSS风险: 动态创建script标签被拦截", level: "block" },
  { pattern: /fetch\s*\(/, message: "网络请求: fetch() 被拦截", level: "block" },
  { pattern: /XMLHttpRequest/, message: "网络请求: XMLHttpRequest 被拦截", level: "block" },
  { pattern: /WebSocket/, message: "网络请求: WebSocket 被拦截", level: "block" },
  { pattern: /localStorage|sessionStorage/, message: "存储访问: localStorage/sessionStorage 被拦截", level: "block" },
  { pattern: /indexedDB/, message: "存储访问: indexedDB 被拦截", level: "block" },
  { pattern: /navigator\s*\.\s*sendBeacon/, message: "数据外泄: sendBeacon 被拦截", level: "block" },
  { pattern: /document\s*\.\s*querySelector/, message: "DOM查询: querySelector 被拦截", level: "block" },
  { pattern: /__proto__|prototype\s*\[/, message: "原型污染: __proto__/prototype 访问被拦截", level: "block" },
  { pattern: /import\s*\(/, message: "动态导入: import() 被拦截", level: "block" },
  { pattern: /setTimeout|setInterval/, message: "定时器: setTimeout/setInterval 被拦截", level: "warn" },
  { pattern: /console\s*\.\s*clear/, message: "调试干扰: console.clear()", level: "warn" },
  { pattern: /while\s*\(\s*true\s*\)/, message: "无限循环: while(true) 被检测", level: "warn" },
  { pattern: /debugger/, message: "调试语句: debugger 被检测", level: "warn" },
];

export function performStaticSecurityScan(code: string, pluginId: string): SecurityScanResult {
  const result: SecurityScanResult = { passed: true, blocked: false, warnings: [], blocks: [] };

  for (const rule of SECURITY_RULES) {
    if (rule.pattern.test(code)) {
      if (rule.level === "block") {
        result.passed = false;
        result.blocked = true;
        result.blocks.push(rule.message);
        SecurityAuditLog.log({
          pluginId,
          type: "scan_blocked",
          message: rule.message,
        });
      } else {
        result.warnings.push(rule.message);
        SecurityAuditLog.log({
          pluginId,
          type: "scan_warning",
          message: rule.message,
        });
      }
    }
  }

  return result;
}

export interface PluginRoute {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  order?: number;
}

export interface PluginAPI {
  registerRoute(route: PluginRoute): void;
  registerNavItem(item: NavItem): void;
  getConfig(): Record<string, unknown>;
  setConfig(config: Record<string, unknown>): void;
  log(...args: unknown[]): void;
  onActivate(fn: () => void | Promise<void>): void;
  onDeactivate(fn: () => void | Promise<void>): void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type PluginModule = {
  activate?: (api: PluginAPI) => void | Promise<void>;
  deactivate?: (api: PluginAPI) => void | Promise<void>;
  default?: (api: PluginAPI) => void | Promise<void>;
  [key: string]: unknown;
};

type PluginActivator = (api: PluginAPI) => void | Promise<void>;

interface PluginInstance {
  manifest: PluginRegistry;
  activator: PluginActivator | null;
  routes: PluginRoute[];
  navItems: NavItem[];
}

const BLACKLIST = new Set([
  "window",
  "self",
  "document",
  "globalThis",
  "global",
  "eval",
  "Function",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "Worker",
  "SharedWorker",
  "ServiceWorker",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "caches",
  "location",
  "navigator",
  "history",
  "alert",
  "confirm",
  "prompt",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "queueMicrotask",
]);

const DANGEROUS_PROPS = new Set([
  "__proto__",
  "prototype",
  "constructor",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

function createSafeObject(): Record<string, unknown> {
  const obj: Record<string, unknown> = Object.create(null);
  for (const key of ["toString", "valueOf", "hasOwnProperty", "isPrototypeOf"]) {
    obj[key] = undefined;
  }
  return obj;
}

function sanitizeKey(key: string | symbol): boolean {
  if (typeof key === "symbol") {
    return DANGEROUS_PROPS.has(key.toString());
  }
  return DANGEROUS_PROPS.has(key);
}

function createSandboxProxy(target: Record<string, unknown>): Record<string, unknown> {
  return new Proxy(target, {
    get(_, prop) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "__proto__" || prop === "prototype" || prop === "constructor") {
        return undefined;
      }
      if (BLACKLIST.has(prop as string)) {
        return undefined;
      }
      const val = target[prop as string];
      if (typeof val === "function") {
        return val.bind(target);
      }
      if (val !== null && typeof val === "object") {
        return createSandboxProxy(val as Record<string, unknown>);
      }
      return val;
    },
    set(_, prop, value) {
      if (sanitizeKey(prop)) {
        return false;
      }
      target[prop as string] = value;
      return true;
    },
    has(_, prop) {
      if (sanitizeKey(prop)) return false;
      return prop in target;
    },
    ownKeys(_) {
      return Object.keys(target).filter((k) => !BLACKLIST.has(k));
    },
    getOwnPropertyDescriptor(_, prop) {
      if (sanitizeKey(prop)) return undefined;
      if (prop in target) {
        return {
          configurable: true,
          enumerable: true,
          value: target[prop as string],
          writable: true,
        };
      }
      return undefined;
    },
    deleteProperty(_, prop) {
      if (sanitizeKey(prop)) return false;
      return delete target[prop as string];
    },
  });
}

function wrapReturnValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "function") return value;
  if (Array.isArray(value)) {
    return value.map(wrapReturnValue);
  }
  if (typeof value === "object") {
    const safe = Object.create(null);
    for (const key of Object.keys(value as object)) {
      if (!sanitizeKey(key)) {
        safe[key] = wrapReturnValue((value as Record<string, unknown>)[key]);
      }
    }
    return createSandboxProxy(safe);
  }
  return value;
}

export class PluginHost {
  private static instance: PluginHost | null = null;
  private plugins: Map<string, PluginInstance> = new Map();

  static getInstance(): PluginHost {
    if (!PluginHost.instance) {
      PluginHost.instance = new PluginHost();
    }
    return PluginHost.instance;
  }

  registerPlugin(manifest: PluginRegistry): PluginAPI {
    const instance: PluginInstance = {
      manifest,
      activator: null,
      routes: [],
      navItems: [],
    };

    const api: PluginAPI = {
      registerRoute: (route) => {
        instance.routes.push(route);
      },
      registerNavItem: (item) => {
        instance.navItems.push(item);
      },
      getConfig: () => {
        return manifest.config ?? {};
      },
      setConfig: (config) => {
        manifest.config = { ...manifest.config, ...config };
      },
      log: (...args) => {
        console.log(`[Plugin:${manifest.id}]`, ...args);
      },
      onActivate: (fn) => {
        instance.activator = fn as PluginActivator;
      },
      onDeactivate: () => {},
    };

    this.plugins.set(manifest.id, instance);
    return api;
  }

  activatePlugin(pluginId: string, code: string): boolean {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      console.warn(`[PluginHost] Plugin ${pluginId} not registered`);
      return false;
    }

    try {
      const execModule = this.createSandbox(pluginId, code);
      const safeModule = execModule as Record<string, unknown>;

      const api = this.getPluginAPI(pluginId);
      if (!api) return false;

      const activateFn =
        (safeModule.activate as PluginActivator) ??
        (safeModule.default as PluginActivator);

      if (typeof activateFn === "function") {
        const result = activateFn(api);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error(`[PluginHost] Plugin ${pluginId} activate error:`, err);
          });
        }
      }

      return true;
    } catch (err) {
      console.error(`[PluginHost] Failed to activate plugin ${pluginId}:`, err);
      return false;
    }
  }

  deactivatePlugin(pluginId: string): void {
    const instance = this.plugins.get(pluginId);
    if (!instance) return;

    instance.activator = null;
    instance.routes = [];
    instance.navItems = [];
  }

  getRoutes(): PluginRoute[] {
    const routes: PluginRoute[] = [];
    for (const [, instance] of this.plugins) {
      if (instance.manifest.status === "active") {
        routes.push(...instance.routes);
      }
    }
    return routes;
  }

  getNavItems(): NavItem[] {
    const items: NavItem[] = [];
    for (const [, instance] of this.plugins) {
      if (instance.manifest.status === "active") {
        items.push(...instance.navItems);
      }
    }
    return items;
  }

  getPluginAPI(pluginId: string): PluginAPI | null {
    const instance = this.plugins.get(pluginId);
    if (!instance) return null;

    return {
      registerRoute: (route) => {
        instance.routes.push(route);
      },
      registerNavItem: (item) => {
        instance.navItems.push(item);
      },
      getConfig: () => {
        return instance.manifest.config ?? {};
      },
      setConfig: (config) => {
        instance.manifest.config = { ...instance.manifest.config, ...config };
      },
      log: (...args) => {
        console.log(`[Plugin:${pluginId}]`, ...args);
      },
      onActivate: (fn) => {
        instance.activator = fn as PluginActivator;
      },
      onDeactivate: () => {},
    };
  }

  createSandbox(pluginId: string, code: string): unknown {
    const sandbox = createSafeObject();
    const context = createSandboxProxy(sandbox);

    const allowedGlobals: Record<string, unknown> = {
      console: {
        log: (...args: unknown[]) => console.log(`[Plugin:${pluginId}]`, ...args),
        warn: (...args: unknown[]) => console.warn(`[Plugin:${pluginId}]`, ...args),
        error: (...args: unknown[]) => console.error(`[Plugin:${pluginId}]`, ...args),
      },
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Promise,
      Symbol,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
      ReferenceError,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      NaN,
      Infinity,
      undefined,
      null: null,
      true: true,
      false: false,
    };

    for (const key of BLACKLIST) {
      context[key] = undefined;
    }

    Object.assign(context, allowedGlobals);

    const paramNames = Object.keys(context);
    const paramValues = paramNames.map((k) => context[k]);

    try {
      const fn = new Function(...paramNames, `"use strict";\n${code}`);
      const result = fn(...paramValues);
      return wrapReturnValue(result);
    } catch (err) {
      console.error(`[PluginHost] Sandbox execution failed for ${pluginId}:`, err);
      throw err;
    }
  }
}
