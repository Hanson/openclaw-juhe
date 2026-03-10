/**
 * Juhe 消息处理 Bot
 */

import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { getJuheRuntime } from "./runtime.js";
import { resolveJuheAccount, isContact, isRoomAvailable, doesRoomRequireMention, isGroupId } from "./config.js";
import { parseJuheTarget, buildJuheTarget } from "./targets.js";
import { createJuheReplyDispatcher } from "./reply-dispatcher.js";
import { sendMessageJuhe } from "./send.js";
import type {
  JuheCallbackEvent,
  JuheMessageContext,
  JuheMessageType,
} from "./types.js";

/**
 * 默认运行时环境
 */
const DEFAULT_RUNTIME: RuntimeEnv = {
  log: console.log,
  error: console.error,
  exit: (code: number) => process.exit(code),
};

/**
 * 思考中表情列表
 */
const THINKING_EMOJIS = ["🚦", "🚝", "🚈", "🚂", "🚁", "🛸", "🛥️", "⛴️", "🛳️", "🏍️", "🛵", "🛴", "🏎️"];

/**
 * 获取随机思考中消息
 */
function getRandomThinkingMessage(): string {
  const emoji = THINKING_EMOJIS[Math.floor(Math.random() * THINKING_EMOJIS.length)];
  return `思考中${emoji}......`;
}

/**
 * 消息去重缓存
 */
const DEDUP_TTL_MS = 30 * 60 * 1000; // 30 分钟
const DEDUP_MAX_SIZE = 1_000;
const processedMessageIds = new Map<string, number>();

/**
 * 尝试记录消息（去重）
 */
function tryRecordMessage(messageId: string): boolean {
  const now = Date.now();

  // 清理过期条目
  if (processedMessageIds.size >= DEDUP_MAX_SIZE) {
    for (const [id, ts] of processedMessageIds) {
      if (now - ts > DEDUP_TTL_MS) {
        processedMessageIds.delete(id);
      }
    }
  }

  if (processedMessageIds.has(messageId)) {
    return false;
  }

  if (processedMessageIds.size >= DEDUP_MAX_SIZE) {
    const first = processedMessageIds.keys().next().value!;
    processedMessageIds.delete(first);
  }

  processedMessageIds.set(messageId, now);
  return true;
}

/**
 * 解析消息内容
 */
function parseMessageContent(content: string, messageType: number): string {
  try {
    const parsed = JSON.parse(content);

    if (messageType === 1) {
      // 文本消息
      return parsed.msg || "";
    }

    if (messageType === 3) {
      // 图片消息
      return "<media:image>";
    }

    if (messageType === 6) {
      // 文件消息
      const fileName = parsed.data?.file?.file_name;
      return fileName ? `<文件: ${fileName}>` : "<media:document>";
    }

    if (messageType === 4) {
      // 语音消息
      return "<media:audio>";
    }

    if (messageType === 5) {
      // 视频消息
      return "<media:video>";
    }

    return content;
  } catch {
    return content;
  }
}

/**
 * 处理 Juhe 回调中的新消息事件
 */
export async function handleJuheMessage(params: {
  cfg: ClawdbotConfig;
  event: JuheCallbackEvent;
  accountId?: string;
  runtime?: RuntimeEnv;
}): Promise<void> {
  const { cfg, event, accountId, runtime } = params;

  const log = runtime?.log ?? console.log;
  const error = runtime?.error ?? console.error;

  const account = resolveJuheAccount({ cfg, accountId });

  // 解析消息数据
  const msgData = event.data;

  // 调试：输出完整的消息数据
  log(`juhe: raw msgData: ${JSON.stringify(msgData)}`);

  // 提取消息 ID
  const messageId = msgData?.msg_id || msgData?.msgid || `${Date.now()}_${Math.random()}`;

  // 去重检查
  if (!tryRecordMessage(messageId)) {
    log(`juhe: skipping duplicate message ${messageId}`);
    return;
  }

  // 解析消息内容
  const messageType = msgData?.msg_type || 1;
  const rawContent = msgData?.content || msgData?.msg || "";
  const content = parseMessageContent(rawContent, messageType);

  // 解析发送者
  // 企微: sender, sender_id, wxid, from_user.id
  // 个微私聊: from_username
  // 个微群聊: chatroom_sender
  const actualSender = msgData?.chatroom_sender || "";
  const senderId = actualSender || msgData?.from_username || msgData?.sender || msgData?.sender_id || msgData?.wxid || msgData?.from_user?.id || "";
  const senderName = msgData?.sender_name || msgData?.from_user?.name || senderId;

  // 解析接收者（用于回复）
  const receiverId = msgData?.receiver || msgData?.receiver_id || "";

  // 解析聊天对象
  // API 返回 roomid (无下划线) 和 chat_id，同时支持两种格式
  // 个微群使用 chatroom 字段
  const roomId = msgData?.chat_id || msgData?.room_id || msgData?.roomid || msgData?.chatroom || "";
  // 企微: is_group, 个微: is_chatroom_msg, 或通过 ID 格式判断
  const isGroupMsg = msgData?.is_group || msgData?.is_chatroom_msg || isGroupId(roomId);
  const chatId = roomId || (isGroupMsg ? senderId : "");

  // 构建消息上下文
  const ctx: JuheMessageContext = {
    guid: event.guid,
    messageId,
    senderId,
    senderName,
    chatId: chatId || senderId,
    chatType: isGroupMsg ? "group" : "direct",
    content,
    contentType: messageType as JuheMessageType,
    isGroup: isGroupMsg,
    timestamp: msgData?.timestamp || Date.now(),
  };

  log(`juhe: received message from ${senderName} (${senderId}) in ${ctx.chatType} ${chatId || "DM"}`);

  // 私聊消息：检查是否为管理员
  if (!isGroupMsg) {
    console.log(`[juhe] bot.ts: account.config=`, JSON.stringify(account.config));
    console.log(`[juhe] bot.ts: account.config.contacts=`, JSON.stringify(account.config.contacts));
    log(`juhe: checking DM from ${senderId}, contacts config: ${JSON.stringify(account.config.contacts)}`);
    if (!isContact(senderId, account)) {
      log(`juhe: ignoring DM from non-admin user ${senderId}`);
      return;
    }
  }

  // 群消息：检查群是否可用，是否需要 @
  if (isGroupMsg) {
    // 检查群是否在配置列表中
    if (!isRoomAvailable(chatId, senderId, account.rooms)) {
      log(`juhe: ignoring message from unconfigured room ${chatId}`);
      return;
    }

    // 检查是否需要 @ 机器人
    if (doesRoomRequireMention(chatId, account.rooms)) {
      // 机器人 ID：个微使用 to_username（机器人自己的微信ID），企微使用 uin
      // 注意：群聊消息中 receiver 为 "0"，不能用作 botId
      // 企微：使用 at_list 中的第一个元素作为 botId（用户 @ 的人就是机器人）
      let atList: string[] = msgData?.at_list || [];
      let botId = msgData?.to_username || account.uin || account.config?.contacts?.[0] || "";
      if (account.type === "wework" && atList.length > 0) {
        botId = atList[0];
      }
      log(`juhe: mention check - account.type=${account.type}, account.uin="${account.uin}", botId="${botId}", at_list=${JSON.stringify(atList)}`);
      // 个微的 @ 信息在 source 字段的 atuserlist 中，企微使用 at_list 数组

      // 解析个微的 atuserlist（如果有）
      if (atList.length === 0 && msgData?.source) {
        const atUserListMatch = msgData.source.match(/<atuserlist><!\[CDATA\[(.*?)\]\]><\/atuserlist>/);
        if (atUserListMatch && atUserListMatch[1]) {
          // atuserlist 可能包含多个 ID，用逗号分隔
          atList = atUserListMatch[1].split(',').filter((id: string) => id);
        }
      }

      // 检查机器人是否被 @
      const isBotMentioned = atList.includes(botId);

      if (!isBotMentioned) {
        log(`juhe: ignoring message from room ${chatId} - bot not mentioned (at_list: ${JSON.stringify(atList)}, botId: ${botId})`);
        return;
      }

      log(`juhe: room ${chatId} requires mention - bot mentioned, processing message`);
    }
  }

  // 检查管理员权限（如果是命令）
  const isUserAdmin = isContact(senderId, account);
  if (content.startsWith("/") && !isUserAdmin) {
    log(`juhe: ignoring admin command from non-admin user ${senderId}`);
    return;
  }

  try {
    const core = getJuheRuntime();

    // 构建目标格式
    const parsedTarget = parseJuheTarget(chatId || senderId);
    const juheTarget = buildJuheTarget({
      type: parsedTarget.type,
      isGroup: ctx.chatType === "group",
      id: parsedTarget.rawId,
    });

    // 构建会话路由
    const peerId = ctx.chatType === "group" ? chatId : senderId;
    const route = core.channel.routing.resolveAgentRoute({
      cfg,
      channel: "juhe",
      accountId: account.accountId,
      peer: {
        kind: ctx.chatType === "group" ? "group" : "direct",
        id: peerId,
      },
    });

    // 构建入站上下文
    const envelopeFrom = `${senderId}:${chatId || "DM"}`;
    const juheFrom = `juhe:${senderId}`;
    const juheTo = ctx.chatType === "group" ? `juhe:group:${chatId}` : `juhe:user:${senderId}`;

    const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(cfg);
    const body = core.channel.reply.formatAgentEnvelope({
      channel: "Juhe",
      from: envelopeFrom,
      timestamp: new Date(ctx.timestamp),
      envelope: envelopeOptions,
      body: `${senderName}: ${content}`,
    });

    const ctxPayload = core.channel.reply.finalizeInboundContext({
      Body: body,
      RawBody: content,
      CommandBody: content,
      From: juheFrom,
      To: juheTo,
      SessionKey: route.sessionKey,
      AccountId: route.accountId,
      ChatType: ctx.chatType,
      GroupSubject: ctx.chatType === "group" ? chatId : undefined,
      SenderName: senderName,
      SenderId: senderId,
      Provider: "juhe" as const,
      Surface: "juhe" as const,
      MessageSid: messageId,
      Timestamp: ctx.timestamp,
      WasMentioned: false, // TODO: 实现提及检测
      CommandAuthorized: isUserAdmin,
      OriginatingChannel: "juhe" as const,
      OriginatingTo: juheTo,
    });

    // 创建 reply dispatcher
    const { dispatcher, replyOptions, markDispatchIdle } = createJuheReplyDispatcher({
      cfg,
      agentId: route.agentId,
      runtime: runtime ?? DEFAULT_RUNTIME,
      // 对于私聊回复给发送者，对于群聊回复给群
      target: isGroupMsg ? chatId : senderId,
      accountId: account.accountId,
      // 传递消息类型用于正确格式化 conversation_id
      isGroup: isGroupMsg,
    });

    // 分发到代理
    log(`juhe: dispatching to agent (session=${route.sessionKey})`);

    // 立即发送"思考中"消息
    console.log(`[juhe] DEBUG: about to send thinking message, isGroupMsg=${isGroupMsg}, account.type=${account.type}, chatId="${chatId}"`);
    // 目标格式：
    // - 个微私聊: {wxid} (无前缀)
    // - 个微群聊: {chatroom} (无前缀)
    // - 企微私聊: S:{uin}
    // - 企微群聊: R:{uin}
    log(`juhe: building replyTarget: isGroupMsg=${isGroupMsg}, account.type=${account.type}, chatId="${chatId}", senderId="${senderId}"`);
    let replyTarget: string;
    if (!isGroupMsg) {
      // 私聊消息
      if (account.type === "wework") {
        replyTarget = senderId.startsWith("S:") ? senderId : `S:${senderId}`;
      } else {
        replyTarget = senderId;
      }
    } else {
      // 群聊消息
      if (account.type === "wework") {
        replyTarget = chatId.startsWith("R:") ? chatId : `R:${chatId}`;
      } else {
        replyTarget = chatId;
      }
    }
    log(`juhe: built replyTarget="${replyTarget}"`);
    try {
      const thinkingMessage = getRandomThinkingMessage();
      await sendMessageJuhe({
        cfg,
        to: replyTarget,
        text: thinkingMessage,
        accountId: account.accountId,
      });
      log(`juhe: thinking message sent to ${replyTarget}`);
    } catch (err) {
      // 思考中消息发送失败不影响主流程
      log(`juhe: failed to send thinking message: ${String(err)}`);
    }

    const { queuedFinal, counts } = await core.channel.reply.dispatchReplyFromConfig({
      ctx: ctxPayload,
      cfg,
      dispatcher,
      replyOptions,
    });

    markDispatchIdle();

    log(`juhe: dispatch complete (queuedFinal=${queuedFinal}, replies=${counts.final})`);
  } catch (err) {
    error(`juhe: failed to dispatch message: ${String(err)}`);
  }
}

/**
 * 处理其他 Juhe 回调事件
 */
export async function handleJuheEvent(params: {
  cfg: ClawdbotConfig;
  event: JuheCallbackEvent;
  runtime?: RuntimeEnv;
}): Promise<void> {
  const { event, runtime } = params;

  const log = runtime?.log ?? console.log;

  switch (event.notify_type) {
    case 11001: // Ready
      log(`juhe: instance ready (${event.guid})`);
      break;
    case 11003: // UserLogin
      log(`juhe: user logged in (${event.guid})`);
      break;
    case 11004: // UserLogout
      log(`juhe: user logged out (${event.guid})`);
      break;
    case 11009: // ContactSyncFinish
      log(`juhe: contact sync finished (${event.guid})`);
      break;
    case 2131: // FriendChange
      log(`juhe: friend changed (${event.guid})`);
      break;
    case 2132: // FriendApply
      log(`juhe: friend apply received (${event.guid})`);
      break;
    case 1002: // RoomMemberAdd
      log(`juhe: room member added (${event.guid})`);
      break;
    case 1003: // RoomMemberDel
      log(`juhe: room member deleted (${event.guid})`);
      break;
    case 1006: // RoomCreate
      log(`juhe: room created (${event.guid})`);
      break;
    default:
      log(`juhe: unhandled event type ${event.notify_type}`);
  }
}
