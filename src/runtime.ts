/**
 * Juhe Runtime 管理
 */

import type { PluginRuntime } from "openclaw/plugin-sdk";

let juheRuntime: PluginRuntime | null = null;

/**
 * 设置 Juhe Runtime
 */
export function setJuheRuntime(runtime: PluginRuntime): void {
  juheRuntime = runtime;
}

/**
 * 获取 Juhe Runtime
 */
export function getJuheRuntime(): PluginRuntime {
  if (!juheRuntime) {
    throw new Error("Juhe runtime not initialized");
  }
  return juheRuntime;
}

/**
 * 检查 Runtime 是否已初始化
 */
export function hasJuheRuntime(): boolean {
  return juheRuntime !== null;
}
