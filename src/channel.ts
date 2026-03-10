/**
 * Juhe Channel Plugin
 *
 * OpenClaw channel plugin for aggregate_chat integration
 */

import type { ChannelPlugin, ClawdbotConfig } from "openclaw/plugin-sdk";
import { DEFAULT_ACCOUNT_ID, PAIRING_APPROVED_MESSAGE } from "openclaw/plugin-sdk";

// 类型辅助：将可能包含 null 的类型转换为只包含 undefined 的类型
type NonNull<T> = T extends null | undefined ? never : T;
import type { ResolvedJuheAccount, JuheConfig } from "./types.js";
import {
  resolveJuheAccount,
  listJuheAccountIds,
  resolveDefaultJuheAccountId,
  isContact,
} from "./config.js";
import { looksLikeJuheId, formatJuheTarget, normalizeJuheTarget } from "./targets.js";
import { sendMessageJuhe } from "./send.js";
import { juheOutbound } from "./outbound.js";
import { startJuheMonitor, stopJuheMonitor, getJuheMonitorState } from "./monitor.js";

const meta = {
  id: "juhe",
  label: "Juhe (聚合聊天)",
  selectionLabel: "Juhe / Aggregate Chat",
  docsPath: "/channels/juhe",
  docsLabel: "juhe",
  blurb: "聚合聊天 - WeChat/WeWork integration via aggregate_chat backend",
  aliases: ["aggregate-chat", "聚合聊天"] as string[],
  order: 50,
};

/**
 * Juhe Channel Plugin
 */
export const juhePlugin: ChannelPlugin<ResolvedJuheAccount> = {
  id: "juhe",
  meta: {
    ...meta,
  },
  pairing: {
    idLabel: "juheId",
    normalizeAllowEntry: (entry) => normalizeJuheTarget(entry),
    notifyApproval: async ({ cfg, id }) => {
      await sendMessageJuhe({
        cfg,
        to: formatJuheTarget(id),
        text: PAIRING_APPROVED_MESSAGE,
        accountId: DEFAULT_ACCOUNT_ID,
      });
    },
  },
  capabilities: {
    chatTypes: ["direct", "channel"],
    polls: false,
    threads: false,
    media: true,
    reactions: false,
    edit: false,
    reply: true,
  },
  agentPrompt: {
    messageToolHints: () => [
      "- Juhe targeting: omit `target` to reply to the current conversation (auto-inferred). Explicit targets: `S:{uin}` (WeWork DM), `R:{uin}` (WeWork group), or `{wxid}` (WeChat).",
      "- Juhe supports text, image, and file messages.",
    ],
  },
  groups: {
    // 暂不支持群组策略
    resolveToolPolicy: () => undefined,
  },
  reload: { configPrefixes: ["channels.juhe"] },
  configSchema: {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        type: { type: "string", enum: ["wework", "wechat"] },
        appKey: { type: "string" },
        appSecret: { type: "string" },
        guid: { type: "string" },
        baseUrl: { type: "string", format: "uri" },
        wsUrl: { type: "string", format: "uri" },
        accountId: { type: "string", description: "Account ID to load from accounts.json" },
        contacts: { type: "array", items: { type: "string" } },
        rooms: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              requireMention: { type: "boolean" },
              scope: { type: "string", enum: ["owner", "everyone", "whitelist"] },
              whitelist: { type: "array", items: { type: "string" } },
            },
            required: ["id"],
          },
        },
      },
    },
  },
  config: {
    listAccountIds: (cfg) => listJuheAccountIds(cfg),
    resolveAccount: (cfg, accountId) => resolveJuheAccount({ cfg, accountId: accountId ?? undefined }),
    defaultAccountId: (cfg) => {
      const id = resolveDefaultJuheAccountId(cfg);
      return id ?? DEFAULT_ACCOUNT_ID;
    },
    setAccountEnabled: ({ cfg, accountId, enabled }) => {
      // 只支持默认账号
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          juhe: {
            ...(cfg.channels?.juhe as JuheConfig | undefined),
            enabled,
          },
        },
      };
    },
    deleteAccount: ({ cfg }) => {
      // 删除 juhe 配置
      const next = { ...cfg } as ClawdbotConfig;
      const nextChannels = { ...cfg.channels };
      delete (nextChannels as Record<string, unknown>).juhe;
      if (Object.keys(nextChannels).length > 0) {
        next.channels = nextChannels;
      } else {
        delete next.channels;
      }
      return next;
    },
    isConfigured: (account) => account.configured,
    describeAccount: (account) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      guid: account.guid ?? undefined,
    }),
    resolveAllowFrom: ({ cfg, accountId }) => {
      const account = resolveJuheAccount({ cfg, accountId: accountId ?? undefined });
      // 返回管理员的 Uin
      return account.uin ? [account.uin] : [];
    },
    formatAllowFrom: ({ allowFrom }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean)
        .map((entry) => normalizeJuheTarget(entry)),
  },
  security: {
    collectWarnings: ({ cfg, accountId }) => {
      const account = resolveJuheAccount({ cfg, accountId: accountId ?? undefined });
      const warnings: string[] = [];

      // 检查是否配置了管理员 Uin（私聊需要）
      if (!account.uin) {
        warnings.push(
          `- Juhe[${account.accountId}]: no uin configured. Add uin in channels.juhe.uin to enable DM support`
        );
      }

      // 检查是否配置了群
      if (!account.rooms || account.rooms.length === 0) {
        warnings.push(
          `- Juhe[${account.accountId}]: no rooms configured. Add rooms in channels.juhe.rooms to enable group support`
        );
      }

      return warnings satisfies string[];
    },
  },
  setup: {
    resolveAccountId: () => DEFAULT_ACCOUNT_ID,
    applyAccountConfig: ({ cfg }) => {
      // 只支持默认账号
      return {
        ...cfg,
        channels: {
          ...cfg.channels,
          juhe: {
            ...(cfg.channels?.juhe as JuheConfig | undefined),
            enabled: true,
          },
        },
      };
    },
  },
  onboarding: {
    // 暂不支持 onboarding
    channel: "juhe",
    configure: async ({ cfg }) => ({
      status: "error",
      cfg,
      error: "Onboarding not supported for Juhe channel",
    }),
    getStatus: async () => ({
      channel: "juhe",
      configured: false,
      status: "unconfigured",
      statusLines: [],
    }),
  },
  messaging: {
    normalizeTarget: normalizeJuheTarget,
    targetResolver: {
      looksLikeId: looksLikeJuheId,
      hint: "<wxid|S:uin|R:uin>",
    },
  },
  directory: {
    self: async () => null,
    listPeers: async () => [],
    listGroups: async () => [],
    listPeersLive: async () => [],
    listGroupsLive: async () => [],
  },
  outbound: juheOutbound,
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
      port: null,
    },
    buildChannelSummary: ({ snapshot }) => ({
      configured: snapshot.configured ?? false,
      running: snapshot.running ?? false,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
      port: snapshot.port ?? null,
    }),
    probeAccount: async ({ account }) => {
      if (!account.configured) {
        return {
          status: "error",
          error: "Account not configured",
        };
      }

      const monitorState = getJuheMonitorState(account.accountId);
      return {
        status: monitorState?.running ? "ok" : "error",
        error: monitorState?.running ? undefined : "Monitor not running",
      };
    },
    buildAccountSnapshot: ({ account, runtime, probe }) => ({
      accountId: account.accountId,
      enabled: account.enabled,
      configured: account.configured,
      running: runtime?.running ?? false,
      lastStartAt: runtime?.lastStartAt ?? null,
      lastStopAt: runtime?.lastStopAt ?? null,
      lastError: runtime?.lastError ?? null,
      port: runtime?.port ?? null,
      probe,
    }),
  },
  gateway: {
    startAccount: async (ctx) => {
      const { accountId } = ctx;
      const account = resolveJuheAccount({ cfg: ctx.cfg, accountId });

      ctx.log?.info(`starting juhe[${accountId}] (WebSocket mode)`);

      await startJuheMonitor({
        cfg: ctx.cfg,
        accountId,
        runtime: ctx.runtime,
        abortSignal: ctx.abortSignal,
      });

      ctx.log?.info(`juhe[${accountId}] started successfully`);
    },
    stopAccount: async (ctx) => {
      const { accountId } = ctx;
      ctx.log?.info(`stopping juhe[${accountId}]`);
      stopJuheMonitor(accountId);
    },
  },
};
