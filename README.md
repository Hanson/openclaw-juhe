# openclaw-juhe

<div align="center">

**聚合聊天通道插件 - 为 OpenClaw 带来微信和企微集成**

[![GitHub](https://img.shields.io/badge/GitHub-hanson%2Fopenclaw--juhe-blue)](https://github.com/hanson/openclaw-juhe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

[特性](#-核心特性) • [快速开始](#-快速开始) • [配置指南](#-配置指南) • [架构设计](#-架构设计) • [API 文档](#-api-文档)

</div>

---

## 项目简介

openclaw-juhe 是 [OpenClaw](https://github.com/openclaw/openclaw) 的通道插件，通过 **juhebot** 后端服务实现微信和企微的消息收发功能。

> **付费说明**
>
> 本插件为 **juhebot 付费平台的专属通道**，需要购买 juhebot 服务方可使用。未购买用户可作为学习参考，了解 OpenClaw 插件的开发模式和架构设计。


[https://wework.apifox.cn/](企微接口)

[https://weixins.apifox.cn/](个微接口)

**OpenClaw** 是一个开源的多通道聊天机器人框架，支持同时接入多个聊天平台（微信、企微、飞书、Telegram 等），并提供统一的 LLM 对话能力。

## 核心特性

### 消息收发
- **多消息类型支持** - 文本、图片、文件、语音、视频
- **私聊与群聊** - 完整支持个人和群组对话
- **@提及检测** - 智能识别群聊中的 @ 机器人消息

### 连接模式
- **WebSocket 客户端（推荐）** - 无需公网 IP，支持内网环境
- **HTTP 回调服务器** - 标准 HTTP 回调，兼容性好
- **自动重连机制** - 连接断开自动重连，最多 10 次尝试

### 账号管理
- **多账号支持** - 单个插件实例支持多个微信/企微账号
- **独立配置文件** - 敏感信息存储在 `accounts.json`，避免泄露
- **权限控制** - 精细化的联系人白名单和群组权限管理

### 用户体验
- **思考中提示** - 收到消息立即发送随机 emoji 提示，提升交互体验
- **消息去重** - 30 分钟内自动过滤重复消息
- **命令权限** - 管理员命令权限校验

## Skills

本插件计划提供以下可扩展技能：

- **会话存档** - 持久化存储聊天记录，支持历史消息查询和回溯
- **数据分析** - 基于 LLM 的对话数据分析，生成聊天摘要和统计报告
- **自动推送** - 定时任务和触发式推送，支持个性化消息推送策略

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置插件

创建配置文件 `openclaw.json`:

```yaml
channels:
  juhe:
    enabled: true
    baseUrl: "https://chat-api.juhebot.com"
    wsUrl: "wss://chat-api.juhebot.com/ws/juwe"
    appKey: "your_app_key"
    appSecret: "your_app_secret"
    guid: "your_guid_here"
    contacts: ["YOUR_WECHAT_ID"]  # 允许私聊的用户 ID
```

### 3. 启动服务

```bash
# 使用 OpenClaw CLI 启动
npx clawbot start
```

## 配置指南

### 回调模式选择

#### WebSocket 模式（推荐）

无需公网 IP，本地服务主动连接到服务器：

```yaml
channels:
  juhe:
    enabled: true
    wsUrl: "wss://chat-api.juhebot.com/ws/juwe"
    # ... 其他配置
```

### 多账号配置

使用 `accounts.json` 管理多个账号：

```json
{
  "account_wework_1": {
    "enabled": true,
    "type": "wework",
    "appKey": "YOUR_APP_KEY",
    "appSecret": "YOUR_APP_SECRET",
    "guid": "YOUR_GUID",
    "contacts": ["YOUR_WEWORK_UIN"],
    "rooms": [
      {
        "id": "YOUR_GROUP_ID",
        "requireMention": true,
        "scope": "everyone"
      }
    ]
  },
  "account_wechat_1": {
    "enabled": true,
    "type": "wechat",
    "appKey": "YOUR_APP_KEY",
    "appSecret": "YOUR_APP_SECRET",
    "guid": "YOUR_GUID",
    "contacts": ["YOUR_WECHAT_ID"]
  }
}
```

### 群组权限配置

群组支持三种权限范围：

| scope | 说明 |
|-------|------|
| `owner` | 仅群主/管理员可用（需配合 whitelist） |
| `whitelist` | 仅白名单用户可用 |
| `everyone` | 所有人可用（默认） |

```yaml
rooms:
  - id: "YOUR_GROUP_ID"
    requireMention: true  # 需要 @ 机器人才回复
    scope: "whitelist"
    whitelist: ["YOUR_USER_ID_1", "YOUR_USER_ID_2"]
```

## 架构设计

### 消息流程

```
┌─────────────┐         WebSocket/HTTP          ┌──────────────────┐
│   juhebot   │  ──────────────────────────>   │  openclaw-juhe   │
│   Backend   │  <──────────────────────────    │   (Plugin)       │
└─────────────┘         Callback Events         └──────────────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │   OpenClaw   │
                                                    │   Core       │
                                                    └──────────────┘
                                                           │
                                                           ▼
                                                    ┌──────────────┐
                                                    │  LLM Agent   │
                                                    └──────────────┘
```

### 目录结构

```
openclaw-juhe/
├── index.ts              # 插件入口
├── src/
│   ├── channel.ts        # ChannelPlugin 实现
│   ├── client.ts         # juhebot API 客户端
│   ├── send.ts           # 消息发送
│   ├── bot.ts            # 消息事件处理
│   ├── callback.ts       # 回调事件解析
│   ├── monitor.ts        # WebSocket/HTTP 监听
│   ├── config.ts         # 配置解析
│   ├── targets.ts        # 目标格式处理
│   ├── runtime.ts        # Runtime 管理
│   ├── types.ts          # TypeScript 类型
│   └── outbound.ts       # Outbound Adapter
├── openclaw.plugin.json  # 插件元数据
├── config.example.yaml   # 配置示例
└── package.json
```

## API 文档

### 消息类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `text` | 文本消息 | `"hello"` |
| `image` | 图片消息 | `<media:image>` |
| `file` | 文件消息 | `<media:document>` |
| `audio` | 语音消息 | `<media:audio>` |
| `video` | 视频消息 | `<media:video>` |

### WebSocket 协议

**认证消息：**

```json
{
  "type": "auth",
  "app_key": "YOUR_APP_KEY",
  "app_secret": "YOUR_APP_SECRET",
  "guid": "YOUR_GUID"
}
```

**认证响应：**

```json
{
  "type": "auth_success"
}
```

**回调事件：**

```json
{
  "type": "callback",
  "event_id": "evt_xxx",
  "event": {
    "guid": "xxx",
    "notify_type": 11010,
    "data": { ... }
  }
}
```

**ACK 确认：**

```json
{
  "type": "ack",
  "event_id": "evt_xxx",
  "success": true
}
```

### 回调事件类型

**企微事件：**

| 事件类型 | 说明 |
|----------|------|
| 11001 | 实例就绪 |
| 11003 | 用户登录 |
| 11004 | 用户登出 |
| 11009 | 联系人同步完成 |
| 11010 | 新消息 |
| 11013 | 批量新消息 |

**个微事件：**

| 事件类型 | 说明 |
|----------|------|
| 1010 | 新消息 |
| 1011 | 批量新消息 |
| 2131 | 好友变更 |
| 2132 | 好友申请 |
| 1002 | 群成员增加 |
| 1003 | 群成员减少 |

## 开发指南

```bash
# 类型检查
npm run type-check

# WebSocket 测试
npm run test-ws
```

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 函数使用 JSDoc 注释

## 常见问题

### Q: 如何获取 appKey、appSecret 和 guid？

A: 登录 juhebot 后台管理界面，创建应用后即可获取相关凭证。

### Q: WebSocket 连接频繁断开怎么办？

A: 插件内置自动重连机制，最多尝试 10 次。如仍无法连接，检查网络和服务器状态。

### Q: 个微和企微的 ID 格式有什么区别？

A: 具体格式请参考购买后提供的《ID 格式说明文档》。

### Q: 如何让机器人只在被 @ 时回复？

A: 在群组配置中设置 `requireMention: true`。

## 相关项目

- [claude-client](https://github.com/Hanson/claude-client) - 📱 用手机远程写代码！通过飞书控制本地 Claude Code（当前支持飞书，后续可能支持更多 IM）

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
