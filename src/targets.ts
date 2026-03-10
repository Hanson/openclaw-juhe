/**
 * Juhe 目标格式处理
 */

import { isGroupId, isWeworkId, isWechatId } from "./config.js";

/**
 * 目标格式描述
 */
export const JUHE_TARGET_HINT = "<wxid|S:uin|R:uin|group_id>";

/**
 * 判断字符串是否像 Juhe ID
 */
export function looksLikeJuheId(target: string): boolean {
  if (!target) return false;

  // 个微 wxid
  if (target.startsWith("wxid_")) return true;

  // 企微私聊 S:
  if (target.startsWith("S:")) return true;

  // 企微群 R:
  if (target.startsWith("R:")) return true;

  // 纯数字（可能是企微 uin 或个微群）
  if (/^\d+$/.test(target)) return true;

  // 个微群格式
  if (target.startsWith("@@") || /^\d{16,}$/.test(target)) return true;

  return false;
}

/**
 * 格式化目标为统一格式
 */
export function formatJuheTarget(target: string): string {
  if (!target) return target;

  // 移除可能的前缀（用于内部处理）
  let normalized = target;

  // 如果有 juhe: 前缀，移除
  if (normalized.startsWith("juhe:")) {
    normalized = normalized.slice(5);
  }

  // 如果有 user: 前缀，移除
  if (normalized.startsWith("user:")) {
    normalized = normalized.slice(5);
  }

  // 如果有 chat: 前缀，移除
  if (normalized.startsWith("chat:")) {
    normalized = normalized.slice(5);
  }

  return normalized;
}

/**
 * 规范化目标格式（用于存储和比较）
 */
export function normalizeJuheTarget(entry: string): string {
  return formatJuheTarget(entry).toLowerCase();
}

/**
 * 解析目标类型
 */
export function parseJuheTarget(target: string): {
  type: "wechat" | "wework";
  rawId: string;
  isGroup: boolean;
} {
  const normalized = formatJuheTarget(target);

  if (normalized.startsWith("R:")) {
    return { type: "wework", rawId: normalized.slice(2), isGroup: true };
  }

  if (normalized.startsWith("S:")) {
    return { type: "wework", rawId: normalized.slice(2), isGroup: false };
  }

  if (normalized.startsWith("@@") || /^\d{16,}$/.test(normalized)) {
    return { type: "wechat", rawId: normalized, isGroup: true };
  }

  if (normalized.startsWith("wxid_") || normalized.startsWith("o")) {
    return { type: "wechat", rawId: normalized, isGroup: false };
  }

  // 默认当作个微处理
  return { type: "wechat", rawId: normalized, isGroup: false };
}

/**
 * 构建目标字符串
 */
export function buildJuheTarget(params: {
  type: "wechat" | "wework";
  isGroup: boolean;
  id: string;
}): string {
  const { type, isGroup, id } = params;

  if (type === "wework") {
    return isGroup ? `R:${id}` : `S:${id}`;
  }

  // wechat 类型不需要前缀
  return id;
}

/**
 * 检查两个目标是否相同
 */
export function isSameTarget(target1: string, target2: string): boolean {
  return normalizeJuheTarget(target1) === normalizeJuheTarget(target2);
}
