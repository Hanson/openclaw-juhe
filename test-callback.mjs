#!/usr/bin/env node

/**
 * 测试 juhe WebSocket 回调功能
 *
 * 这个脚本会：
 * 1. 连接到 aggregate_chat 的 /ws/juwe WebSocket 端点
 * 2. 发送认证消息
 * 3. 等待接收回调消息
 * 4. 显示接收到的消息
 */

const WS_URL = 'wss://dev-chat-api.juhebot.com/ws/juwe';
const APP_KEY = '123';
const APP_SECRET = '456';
const GUID = 'fbaeeed9-71b4-362a-af79-1950573d4fcc';

async function testWebSocket() {
  console.log('正在连接到 WebSocket:', WS_URL);

  const ws = new WebSocket(WS_URL);

  ws.addEventListener('open', () => {
    console.log('✓ WebSocket 连接成功');

    // 发送认证消息
    const authMsg = {
      type: 'auth',
      app_key: APP_KEY,
      app_secret: APP_SECRET,
      guid: GUID
    };

    console.log('发送认证消息:', JSON.stringify({ ...authMsg, app_secret: '***' }));
    ws.send(JSON.stringify(authMsg));
  });

  ws.addEventListener('message', (event) => {
    const data = event.data;
    try {
      const msg = JSON.parse(data);
      console.log('\n✓ 收到消息:', JSON.stringify(msg, null, 2));

      if (msg.type === 'auth_success') {
        console.log('✓ 认证成功！等待回调消息...');
        console.log('提示：现在可以在群里发送消息来测试回调功能');
      } else if (msg.type === 'callback') {
        console.log('✓ 收到回调消息！');
        console.log('事件类型:', msg.event?.notify_type);
        console.log('事件数据:', JSON.stringify(msg.event, null, 2));

        // 发送 ACK 确认
        const ackMsg = {
          type: 'ack',
          event_id: msg.event_id,
          success: true
        };
        ws.send(JSON.stringify(ackMsg));
        console.log('✓ 已发送 ACK 确认');
      } else if (msg.type === 'error') {
        console.error('✗ 收到错误:', msg.message);
      }
    } catch (err) {
      console.log('原始消息:', data.toString());
    }
  });

  ws.addEventListener('error', (err) => {
    console.error('✗ WebSocket 错误:', err.message);
  });

  ws.addEventListener('close', () => {
    console.log('✗ WebSocket 连接关闭');
  });

  // 保持连接
  console.log('等待消息... (按 Ctrl+C 退出)');
}

// 运行测试
testWebSocket().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
