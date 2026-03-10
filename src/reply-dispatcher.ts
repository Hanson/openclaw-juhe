/**
 * Juhe Reply Dispatcher
 * 处理来自 Agent 的回复并转发到企微/个微
 */

import type {
  ClawdbotConfig,
  RuntimeEnv
} from "openclaw/plugin-sdk";
import { getJuheRuntime } from "./runtime.js";
import { resolveJuheAccount } from "./config.js";
import { sendMessageJuhe } from "./send.js";
import { parseJuheTarget, buildJuheTarget } from "./targets.js";

/**
 * Reply payload 类型（简化版，与 openclaw 兼容）
 */
type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  replyToId?: string;
  replyToTag?: boolean;
};

/**
 * Reply dispatcher 类型（简化版，与 openclaw 兼容）
 */
type ReplyDispatcher = {
  sendToolResult: (payload: ReplyPayload) => boolean;
  sendBlockReply: (payload: ReplyPayload) => boolean;
  sendFinalReply: (payload: ReplyPayload) => boolean;
  waitForIdle: () => Promise<void>;
  getQueuedCounts: () => Record<string, number>;
  markComplete: () => void;
};

export type CreateJuheReplyDispatcherParams = {
  cfg: ClawdbotConfig;
  agentId: string;
  runtime: RuntimeEnv;
  target: string;
  accountId?: string;
  /** 是否为群消息（用于正确格式化企微 conversation_id） */
  isGroup?: boolean;
};

/**
 * 创建 Juhe Reply Dispatcher
 */
export function createJuheReplyDispatcher(params: CreateJuheReplyDispatcherParams) {
  const { cfg, agentId, target, accountId, runtime, isGroup = false } = params;
  const core = getJuheRuntime();
  const account = resolveJuheAccount({ cfg, accountId });

  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  log(`juhe reply-dispatcher: accountId=${accountId}, account.guid=${account.guid}, account.configured=${account.configured}`);

  let finalReplySent = false;
  let blockReplyCount = 0;
  let toolResultCount = 0;

  const dispatcher = {
    /** 发送工具调用结果（暂不实现） */
    sendToolResult: (payload: ReplyPayload) => {
      toolResultCount++;
      return false;
    },

    /** 发送块回复（暂不实现） */
    sendBlockReply: (payload: ReplyPayload) => {
      blockReplyCount++;
      return false;
    },

    /** 发送最终回复 */
    sendFinalReply: (payload: ReplyPayload) => {
      log(`juhe reply-dispatcher: sendFinalReply called, finalReplySent=${finalReplySent}, target=${target}`);

      if (finalReplySent) {
        log(`juhe reply-dispatcher: already sent, skipping`);
        return false;
      }
      finalReplySent = true;

      // 异步发送消息，不等待结果
      (async () => {
        try {
          // 处理 payload 提取文本内容
          let textContent = payload.text ?? "";

          // 确保 textContent 是字符串
          if (typeof textContent !== "string") {
            textContent = String(textContent);
          }

          // 格式化目标地址
          // 企微私聊用 S:，群聊用 R:；个微直接使用 wxid，不加前缀
          let formattedTarget = target;

          if (account.type === "wechat") {
            // 个微：直接使用 wxid，不加前缀（已经以 wxid_ 或 o 开头）
            // 如果 target 没有前缀，保持原样（个微的原始 ID）
            formattedTarget = target;
          } else {
            // 企微：需要添加前缀
            if (!target.startsWith("S:") && !target.startsWith("R:") && !target.startsWith("wxid_") && !target.startsWith("o")) {
              // 这是一个数字ID，根据消息类型添加前缀
              formattedTarget = isGroup ? `R:${target}` : `S:${target}`;
            }
          }

          log(`juhe reply-dispatcher: sending final reply, target=${target}, formattedTarget=${formattedTarget}, type=${account.type}, text=${textContent}`);

          await sendMessageJuhe({
            cfg,
            to: formattedTarget,
            text: textContent,
            accountId,
          });

          log(`juhe reply-dispatcher: reply sent successfully`);
        } catch (err) {
          error(`juhe: failed to send reply: ${err}`);
        }
      })();

      return true;
    },

    /** 等待空闲（无操作） */
    waitForIdle: async () => {
      // No-op for juhe
    },

    /** 获取队列计数 */
    getQueuedCounts: () => ({
      tool: toolResultCount,
      block: blockReplyCount,
      final: finalReplySent ? 1 : 0,
    }),

    /** 标记完成 */
    markComplete: () => {
      // No-op for juhe
    },
  } as ReplyDispatcher;

  return {
    dispatcher,
    replyOptions: {},
    markDispatchIdle: () => {
      // No-op for juhe
    },
  };
}
