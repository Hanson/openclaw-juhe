/**
 * WebSocket 连接测试脚本
 * 测试 juhe WebSocket 服务端
 */

import WebSocket from 'ws';

const config = {
  wsUrl: 'wss://dev-chat-api.juhebot.com/ws/juwe',
  appKey: '123',
  appSecret: '456',
  guid: 'fbaeeed9-71b4-362a-af79-1950573d4fcc'
};

console.log(`连接到: ${config.wsUrl}`);

const ws = new WebSocket(config.wsUrl);

ws.on('open', () => {
  console.log('✓ WebSocket 已连接');

  // 发送认证消息
  const authMsg = {
    type: 'auth',
    app_key: config.appKey,
    app_secret: config.appSecret,
    guid: config.guid
  };

  console.log('发送认证消息:', JSON.stringify(authMsg, null, 2));
  ws.send(JSON.stringify(authMsg));
});

ws.on('message', (data) => {
  console.log('收到消息:', data.toString());

  try {
    const msg = JSON.parse(data.toString());

    if (msg.type === 'auth_success') {
      console.log('✓ 认证成功！');
    } else if (msg.type === 'error') {
      console.error('✗ 认证失败:', msg.message);
    } else if (msg.type === 'callback') {
      console.log('收到回调事件:', msg);

      // 发送 ACK
      const ackMsg = {
        type: 'ack',
        event_id: msg.event_id,
        success: true
      };
      ws.send(JSON.stringify(ackMsg));
    }
  } catch (e) {
    console.log('收到消息（非JSON）:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('WebSocket 错误:', error.message);
});

ws.on('close', () => {
  console.log('WebSocket 连接已关闭');
});

// 30秒后超时退出
setTimeout(() => {
  console.log('测试超时，关闭连接');
  ws.close();
  process.exit(0);
}, 30000);
