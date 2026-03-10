#!/usr/bin/env node

/**
 * 端到端测试：模拟完整的消息流程
 *
 * 这个脚本会：
 * 1. 连接到 aggregate_chat 的 WebSocket 端点
 * 2. 发送认证消息
 * 3. 模拟 xbot 回调（通过 HTTP 请求）
 * 4. 验证 WebSocket 是否收到推送的消息
 */

const WS_URL = 'wss://dev-chat-api.juhebot.com/ws/juwe';
const CALLBACK_URL = 'https://dev-chat-api.juhebot.com/public/XbotCallback';
const APP_KEY = '123';
const APP_SECRET = '456';
const GUID = 'fbaeeed9-71b4-362a-af79-1950573d4fcc';

let wsReceivedCallback = false;
let wsMessageData = null;

async function testFullFlow() {
  console.log('=== 开始端到端测试 ===\n');

  // 步骤 1: 连接 WebSocket
  console.log('步骤 1: 连接 WebSocket...');
  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.addEventListener('open', () => {
      console.log('✓ WebSocket 连接成功\n');

      // 发送认证消息
      const authMsg = {
        type: 'auth',
        app_key: APP_KEY,
        app_secret: APP_SECRET,
        guid: GUID
      };

      ws.send(JSON.stringify(authMsg));
      console.log('✓ 认证消息已发送\n');
    });

    ws.addEventListener('message', (event) => {
      const data = event.data;
      try {
        const msg = JSON.parse(data);

        if (msg.type === 'auth_success') {
          console.log('✓ WebSocket 认证成功\n');
          console.log('等待回调推送...\n');
          resolve();
        } else if (msg.type === 'callback') {
          console.log('✓✓✓ 收到回调推送！✓✓✓');
          console.log('消息数据:', JSON.stringify(msg, null, 2));
          wsReceivedCallback = true;
          wsMessageData = msg;
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

    // 超时保护
    setTimeout(() => {
      if (!wsReceivedCallback) {
        console.log('⏱ WebSocket 等待超时，继续测试...');
        resolve();
      }
    }, 3000);
  });

  // 步骤 2: 等待一下让 WebSocket 完全连接
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 步骤 3: 模拟 xbot 回调
  console.log('步骤 2: 模拟 xbot 回调...');

  const callbackData = {
    guid: GUID,
    notify_type: 11010, // 新消息事件类型
    // 添加其他必要的字段...
  };

  try {
    const response = await fetch(CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callbackData)
    });

    const result = await response.json();
    console.log('✓ 回调请求已发送，响应:', JSON.stringify(result));
  } catch (err) {
    console.error('✗ 回调请求失败:', err.message);
  }

  // 步骤 4: 等待 WebSocket 推送
  console.log('\n步骤 3: 等待 WebSocket 推送...');

  await new Promise(resolve => setTimeout(resolve, 3000));

  // 步骤 5: 检查结果
  console.log('\n=== 测试结果 ===');

  if (wsReceivedCallback) {
    console.log('✅ 测试成功！消息推送功能正常工作');
    console.log('收到的消息:', wsMessageData);
  } else {
    console.log('❌ 测试失败：没有收到 WebSocket 推送');
    console.log('\n可能的原因：');
    console.log('1. WebSocket 客户端未正确注册回调');
    console.log('2. guid 不匹配');
    console.log('3. 后端推送逻辑有问题');
    console.log('\n建议：');
    console.log('- 检查后端日志中的 "juwe: push callback" 记录');
    console.log('- 检查后端日志中的 "juwe: callback registered" 记录');
    console.log('- 确认 WebSocket 连接是否保持活跃');
  }

  // 关闭连接
  ws.close();

  console.log('\n=== 测试完成 ===');

  process.exit(wsReceivedCallback ? 0 : 1);
}

testFullFlow().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
