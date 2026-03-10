/**
 * Juhe (aggregate_chat) 类型定义
 */

/** 回调模式 */
export type JuheCallbackMode = "websocket" | "http";

/** 实例类型 */
export type JuheInstanceType = "wechat" | "wework";

/** 群可用范围 */
export type JuheRoomScope = "owner" | "everyone" | "whitelist";

/** 群配置 */
export interface JuheRoomConfig {
  /** 群 ID（企微群格式：R:xxx 或纯数字） */
  id: string;
  /** 是否需要 @ 机器人才回复 */
  requireMention?: boolean;
  /** 可用范围 */
  scope?: JuheRoomScope;
  /** 白名单用户 ID 列表（仅当 scope=whitelist 时有效） */
  whitelist?: string[];
}

/** Juhe 配置 */
export interface JuheConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 实例类型 */
  type?: JuheInstanceType;
  /** App Key */
  appKey?: string;
  /** App Secret */
  appSecret?: string;
  /** 机器人实例 GUID */
  guid?: string;
  /** Base URL（仅本地开发使用，生产环境固定） */
  baseUrl?: string;
  /** WebSocket URL（可选，默认使用 baseUrl 生成） */
  wsUrl?: string;
  /** 联系人 Uin 列表（列表中的用户私聊会回复） */
  contacts?: string[];
  /** 群配置列表 */
  rooms?: JuheRoomConfig[];
  /** 账号 ID（用于从 accounts.json 加载完整配置） */
  accountId?: string;
}

/** 完整账号配置（存储在 accounts.json 中） */
export interface JuheAccountConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 实例类型 */
  type: JuheInstanceType;
  /** App Key */
  appKey: string;
  /** App Secret */
  appSecret: string;
  /** 机器人实例 GUID */
  guid: string;
  /** Base URL */
  baseUrl?: string;
  /** WebSocket URL（可选，默认使用 baseUrl 生成） */
  wsUrl?: string;
  /** 联系人 Uin 列表（列表中的用户私聊会回复） */
  contacts?: string[];
  /** 群配置列表 */
  rooms?: JuheRoomConfig[];
}

/** accounts.json 结构 */
export interface JuheAccountsRegistry {
  [accountId: string]: JuheAccountConfig;
}

/** 解析后的账号配置 */
export interface ResolvedJuheAccount {
  accountId: string;
  enabled: boolean;
  configured: boolean;
  config: JuheConfig;
  baseUrl: string;
  /** WebSocket 服务器地址 */
  wsUrl: string;
  appKey: string;
  appSecret: string;
  guid: string;
  type: JuheInstanceType;
  uin: string;
  rooms?: JuheRoomConfig[];
}

/** 消息类型 */
export const enum JuheMessageType {
  Text = 1,
  Image = 3,
  Audio = 4,
  Video = 5,
  File = 6,
}

/** 发送消息请求 */
export interface JuheSendMsgRequest {
  guid: string;
  to: string;
  type: JuheMessageType;
  content: string;
}

/** 发送消息响应 */
export interface JuheSendMsgResponse {
  err_code: number;
  err_msg?: string;
  data?: any;
}

/** 回调事件类型 */
export const enum JuheCallbackEventType {
  // 企微事件类型
  Ready = 11001,
  LoginQRCodeChange = 11002,
  UserLogin = 11003,
  UserLogout = 11004,
  InitFinish = 11005,
  HeartBeatError = 11006,
  SessionTimeout = 11007,
  LoginFailed = 11008,
  ContactSyncFinish = 11009,
  NewMsg = 11010,
  LoginOtherDevice = 11011,
  LoginSafeVerify = 11012,
  BatchNewMsg = 11013,
  // 个微事件类型
  WechatNewMsg = 1010,
  WechatBatchNewMsg = 1011,
  FriendChange = 2131,
  FriendApply = 2132,
  RoomNameChange = 1001,
  RoomDismiss = 1023,
  SystemTips = 1037,
  RoomInfoChange = 2118,
  RoomMemberAdd = 1002,
  RoomMemberDel = 1003,
  RoomKickMember = 1004,
  RoomExit = 1005,
  RoomCreate = 1006,
}

/** 回调事件 */
export interface JuheCallbackEvent {
  guid: string;
  notify_type: JuheCallbackEventType;
  data?: any;
}

/** 消息内容 */
export interface JuheMessageContent {
  type: number;
  data: {
    msg?: string; // 文本内容
    image?: { aes_key?: string; url?: string }; // 图片
    file?: { aes_key?: string; url?: string; file_name?: string }; // 文件
    audio?: { aes_key?: string; url?: string }; // 语音
    video?: { aes_key?: string; url?: string }; // 视频
  };
}

/** 消息上下文 */
export interface JuheMessageContext {
  guid: string;
  messageId: string;
  senderId: string;
  senderName?: string;
  chatId: string;
  chatType: "direct" | "group";
  content: string;
  contentType: JuheMessageType;
  isGroup: boolean;
  timestamp: number;
}

/** 媒体信息 */
export interface JuheMediaInfo {
  path: string;
  contentType: string;
  placeholder: string;
}

/** WebSocket 消息类型 */
export interface JuheWSMessage {
  type: "auth" | "auth_success" | "callback" | "ack" | "error";
  event_id?: string;
  event?: any;
  success?: boolean;
  message?: string;
}

/** 监听器状态 */
export interface JuheMonitorState {
  accountId: string;
  running: boolean;
  mode: JuheCallbackMode;
  port?: number;
  server?: any;
  ws?: WebSocket;
  abortController?: AbortController;
}
