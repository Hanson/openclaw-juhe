/**
 * Juhe Outbound Adapter 实现
 */

import type { ChannelOutboundAdapter, ChannelOutboundContext } from "openclaw/plugin-sdk";
import { resolveJuheAccount } from "./config.js";
import { formatJuheTarget } from "./targets.js";
import { sendMessageJuhe, sendImageJuhe, sendFileJuhe } from "./send.js";

/**
 * 辅助函数：发送消息并返回结果
 */
async function sendAndReturnResult(fn: () => Promise<void>, channel: string = "juhe") {
  try {
    await fn();
    return { ok: true, channel, messageId: crypto.randomUUID() };
  } catch (error) {
    return {
      ok: false,
      channel,
      messageId: crypto.randomUUID(),
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Juhe Outbound Adapter
 */
export const juheOutbound: ChannelOutboundAdapter = {
  deliveryMode: "direct",

  /**
   * 发送文本消息
   */
  sendText: async (ctx: ChannelOutboundContext) => {
    return sendAndReturnResult(async () => {
      const { cfg, to, text, accountId } = ctx;
      const account = resolveJuheAccount({ cfg, accountId: accountId ?? undefined });

      const normalizedTarget = formatJuheTarget(to);
      await sendMessageJuhe({
        cfg,
        to: normalizedTarget,
        text,
        accountId: account.accountId,
      });
    });
  },

  /**
   * 发送图片消息
   */
  sendMedia: async (ctx: ChannelOutboundContext) => {
    return sendAndReturnResult(async () => {
      const { cfg, to, mediaUrl, accountId } = ctx;
      const account = resolveJuheAccount({ cfg, accountId: accountId ?? undefined });

      const normalizedTarget = formatJuheTarget(to);
      await sendImageJuhe({
        cfg,
        to: normalizedTarget,
        imageUrl: mediaUrl!,
        accountId: account.accountId,
      });
    });
  },
};
