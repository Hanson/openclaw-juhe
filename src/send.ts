/**
 * Juhe 消息发送实现
 */

import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { getJuheRuntime } from "./runtime.js";
import { resolveJuheAccount } from "./config.js";
import { createJuheClient } from "./client.js";
import type { JuheMessageType } from "./types.js";

/**
 * 发送文本消息到 Juhe
 */
export async function sendMessageJuhe(params: {
  cfg: ClawdbotConfig;
  to: string;
  text: string;
  accountId?: string;
}): Promise<void> {
  const { cfg, to, text, accountId } = params;

  const account = resolveJuheAccount({ cfg, accountId });
  if (!account.configured) {
    throw new Error("Juhe account not configured");
  }

  // 调试日志
  console.log(`juhe send: accountId=${accountId}, account.guid=${account.guid}, account.config.guid=${account.config?.guid}`);

  const client = createJuheClient(account.config);
  const result = await client.sendText(to, text);

  if (result.err_code !== 0) {
    throw new Error(`Juhe send failed: ${result.err_msg || result.err_code}`);
  }
}

/**
 * 发送图片消息到 Juhe
 */
export async function sendImageJuhe(params: {
  cfg: ClawdbotConfig;
  to: string;
  imageUrl: string;
  accountId?: string;
}): Promise<void> {
  const { cfg, to, imageUrl, accountId } = params;

  const account = resolveJuheAccount({ cfg, accountId });
  if (!account.configured) {
    throw new Error("Juhe account not configured");
  }

  const client = createJuheClient(account.config);
  const result = await client.sendImage(to, imageUrl);

  if (result.err_code !== 0) {
    throw new Error(`Juhe send failed: ${result.err_msg || result.err_code}`);
  }
}

/**
 * 发送文件消息到 Juhe
 */
export async function sendFileJuhe(params: {
  cfg: ClawdbotConfig;
  to: string;
  fileUrl: string;
  fileName?: string;
  accountId?: string;
}): Promise<void> {
  const { cfg, to, fileUrl, fileName, accountId } = params;

  const account = resolveJuheAccount({ cfg, accountId });
  if (!account.configured) {
    throw new Error("Juhe account not configured");
  }

  const client = createJuheClient(account.config);
  const result = await client.sendFile(to, fileUrl, fileName);

  if (result.err_code !== 0) {
    throw new Error(`Juhe send failed: ${result.err_msg || result.err_code}`);
  }
}

/**
 * 上传媒体文件
 * 注意：需要 aggregate_chat 支持 CDN 上传接口
 */
export async function uploadMediaJuhe(params: {
  cfg: ClawdbotConfig;
  buffer: Buffer;
  contentType: string;
  fileName?: string;
  accountId?: string;
}): Promise<{ url: string }> {
  const { cfg, buffer, contentType, fileName, accountId } = params;

  const account = resolveJuheAccount({ cfg, accountId });
  if (!account.configured) {
    throw new Error("Juhe account not configured");
  }

  // TODO: 实现 CDN 上传
  // 目前先返回占位符
  return {
    url: `data:${contentType};base64,${buffer.toString("base64")}`,
  };
}

/**
 * 通用消息发送（带类型）
 */
export async function sendMessageWithTypeJuhe(params: {
  cfg: ClawdbotConfig;
  to: string;
  type: JuheMessageType;
  content: string;
  accountId?: string;
}): Promise<void> {
  const { cfg, to, type, content, accountId } = params;

  const account = resolveJuheAccount({ cfg, accountId });
  if (!account.configured) {
    throw new Error("Juhe account not configured");
  }

  const client = createJuheClient(account.config);
  const result = await client.guidRequest({
    path: "/msg/send",
    data: {
      guid: account.guid,
      to,
      type,
      content,
    },
  });

  if (result.err_code !== 0) {
    throw new Error(`Juhe send failed: ${result.err_msg || result.err_code}`);
  }
}
