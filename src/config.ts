/**
 * Juhe 配置解析工具
 */

import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID } from "openclaw/plugin-sdk";
import type { JuheConfig, ResolvedJuheAccount, JuheRoomConfig, JuheInstanceType, JuheAccountsRegistry, JuheAccountConfig } from "./types.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/** 生产环境 URL */
const PRODUCTION_BASE_URL = "https://chat-api.juhebot.com";
const PRODUCTION_WS_URL = "wss://chat-api.juhebot.com/ws/juwe";

/** 默认配置 */
const DEFAULT_JUHE_CONFIG: Partial<JuheConfig> = {
  enabled: false,
  type: "wework",
};

/**
 * 获取插件目录路径
 */
function getPluginDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  return dirname(__filename);
}

/**
 * 加载 accounts.json
 */
function loadAccountsRegistry(): JuheAccountsRegistry {
  try {
    const accountsPath = join(getPluginDir(), "..", "accounts.json");
    const content = readFileSync(accountsPath, "utf-8");
    return JSON.parse(content) as JuheAccountsRegistry;
  } catch (error) {
    // 如果文件不存在或解析失败，返回空对象
    return {};
  }
}

/**
 * 从 accounts.json 获取账号配置
 */
function getAccountConfigFromRegistry(accountId: string): JuheAccountConfig | null {
  const registry = loadAccountsRegistry();
  return registry[accountId] || null;
}

/**
 * 解析 Juhe 账号配置
 */
export function resolveJuheAccount(params: {
  cfg: ClawdbotConfig;
  accountId?: string;
}): ResolvedJuheAccount {
  const { cfg, accountId: paramAccountId = DEFAULT_ACCOUNT_ID } = params;

  let channelCfg = cfg.channels?.juhe as JuheConfig | undefined;

  // 如果配置中指定了 accountId，从 accounts.json 加载完整配置
  if (channelCfg?.accountId) {
    const registryAccount = getAccountConfigFromRegistry(channelCfg.accountId);
    if (registryAccount) {
      // 合并配置：accounts.json 的配置优先级更高
      channelCfg = {
        ...channelCfg,
        ...registryAccount,
        // 保留 accountId 引用
        accountId: channelCfg.accountId,
      };
    }
  }

  const config = { ...DEFAULT_JUHE_CONFIG, ...channelCfg } as JuheConfig;

  // 使用配置中的 accountId，如果没有则使用传入的参数
  const effectiveAccountId = config.accountId || paramAccountId;

  // 生产环境使用固定 URL，开发环境使用配置的 baseUrl
  const isDevelopment = config.baseUrl && config.baseUrl.includes("dev");
  const baseUrl: string = isDevelopment ? config.baseUrl! : PRODUCTION_BASE_URL;
  const wsUrl: string = config.wsUrl || (isDevelopment && config.baseUrl
    ? config.baseUrl.replace(/^http/, "ws") + "/ws/juwe"
    : PRODUCTION_WS_URL
  );

  const configured = !!(
    config.appKey &&
    config.appSecret &&
    config.guid
  );

  return {
    accountId: effectiveAccountId,
    enabled: config.enabled ?? false,
    configured,
    config,
    baseUrl,
    wsUrl,
    appKey: config.appKey ?? "",
    appSecret: config.appSecret ?? "",
    guid: config.guid ?? "",
    type: config.type ?? "wework",
    uin: config.contacts?.[0] ?? "",
    rooms: config.rooms,
  };
}

/**
 * 列出所有 Juhe 账号 ID
 */
export function listJuheAccountIds(cfg: ClawdbotConfig): string[] {
  const channelCfg = cfg.channels?.juhe as JuheConfig | undefined;
  if (!channelCfg) return [];

  // 如果配置中指定了 accountId，返回该 ID
  if (channelCfg.accountId) {
    const registry = loadAccountsRegistry();
    if (registry[channelCfg.accountId]) {
      return [channelCfg.accountId];
    }
  }

  // 如果有直接配置的 appKey 或 guid，返回默认账号
  if (channelCfg.appKey || channelCfg.guid) {
    return [DEFAULT_ACCOUNT_ID];
  }

  // 返回 accounts.json 中所有启用的账号 ID
  const registry = loadAccountsRegistry();
  const accountIds = Object.keys(registry).filter(id => registry[id]?.enabled !== false);
  return accountIds.length > 0 ? accountIds : [];
}

/**
 * 解析默认账号 ID
 */
export function resolveDefaultJuheAccountId(cfg: ClawdbotConfig): string | undefined {
  const channelCfg = cfg.channels?.juhe as JuheConfig | undefined;
  if (!channelCfg) return undefined;

  // 优先返回配置中指定的 accountId
  if (channelCfg.accountId) {
    return channelCfg.accountId;
  }

  // 如果有直接配置的 appKey 或 guid，返回默认账号
  if (channelCfg.appKey || channelCfg.guid) {
    return DEFAULT_ACCOUNT_ID;
  }

  // 返回 accounts.json 中的第一个账号 ID
  const registry = loadAccountsRegistry();
  const accountIds = Object.keys(registry);
  return accountIds.length > 0 ? accountIds[0] : undefined;
}

/**
 * 检查是否为联系人（列表中的用户私聊会回复）
 */
export function isContact(senderId: string, account: ResolvedJuheAccount): boolean {
  // 检查 contacts 列表
  if (account.config.contacts && account.config.contacts.length > 0) {
    for (const contact of account.config.contacts) {
      const normalizedContact = contact.replace(/^[SR]:/, '');
      const normalizedSenderId = senderId.replace(/^[SR]:/, '');
      if (normalizedContact === normalizedSenderId) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 检查群是否可用
 */
export function isRoomAvailable(roomId: string, senderId: string, rooms?: JuheRoomConfig[]): boolean {
  if (!rooms || rooms.length === 0) return false;

  const room = rooms.find(r => {
    const normalizedRoomId = r.id.replace(/^[SR]:/, '');
    const normalizedTargetId = roomId.replace(/^[SR]:/, '');
    return normalizedRoomId === normalizedTargetId;
  });

  if (!room) return false;

  // 根据 scope 判断
  switch (room.scope || 'everyone') {
    case 'owner':
      // 仅群主可用（需要检查 senderId 是否在白名单中，或者使用其他方式判断）
      return room.whitelist?.includes(senderId) || false;
    case 'whitelist':
      // 白名单用户可用
      return room.whitelist?.includes(senderId) || false;
    case 'everyone':
    default:
      // 所有人可用
      return true;
  }
}

/**
 * 检查群消息是否需要 @
 */
export function doesRoomRequireMention(roomId: string, rooms?: JuheRoomConfig[]): boolean {
  if (!rooms || rooms.length === 0) return false;

  const room = rooms.find(r => {
    const normalizedRoomId = r.id.replace(/^[SR]:/, '');
    const normalizedTargetId = roomId.replace(/^[SR]:/, '');
    return normalizedRoomId === normalizedTargetId;
  });

  return room?.requireMention ?? false;
}

/**
 * 判断是否为群聊 ID
 */
export function isGroupId(target: string): boolean {
  return (
    target.startsWith("R:") || // 企微群
    target.startsWith("@@") || // 个微群 (新格式)
    /^\d{16,}$/.test(target) // 个微群 (旧格式)
  );
}

/**
 * 判断是否为企微 ID
 */
export function isWeworkId(target: string): boolean {
  return (
    target.startsWith("S:") || // 企微私聊
    target.startsWith("R:") || // 企微群
    /^\d{9,}$/.test(target) // 企微 uin
  );
}

/**
 * 判断是否为个微 ID
 */
export function isWechatId(target: string): boolean {
  return (
    target.startsWith("wxid_") ||
    target.startsWith("o") ||
    (!isWeworkId(target) && !isGroupId(target))
  );
}
