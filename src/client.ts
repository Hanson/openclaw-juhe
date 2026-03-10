/**
 * aggregate_chat API 客户端
 */

import type { JuheConfig } from "./types.js";

/**
 * Juhe API 客户端
 */
export class JuheClient {
  constructor(
    private readonly config: JuheConfig,
    private readonly log: (msg: string) => void,
  ) {}

  /**
   * 调用 GuidRequest 接口代理请求
   * 正确格式：顶层包含 app_key, app_secret, path，data 包含目标接口参数
   */
  async guidRequest(params: {
    path: string;
    data: Record<string, unknown>;
  }): Promise<{ err_code: number; err_msg?: string; data?: any }> {
    const { path, data } = params;

    try {
      const url = `${this.config.baseUrl}/open/GuidRequest`;

      // 正确的请求结构：顶层身份参数 + data 包含接口参数
      const requestBody = {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        path,
        data,  // data 作为嵌套对象，包含目标接口的参数
      };

      // 调试日志
      console.log(`juhe client: config.guid=${this.config.guid}, data.guid=${data.guid}`);
      console.log(`juhe client: requestBody=${JSON.stringify(requestBody)}`);

      this.log(`juhe: GuidRequest ${path} -> ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as any;

      // 调试日志
      console.log(`juhe client: response=${JSON.stringify(result)}`);

      // aggregate_chat 响应格式：
      // 成功: { "baseResponse": { "ret": 0 }, "list": [{ "ret": 0 }] }
      // 失败: { "baseResponse": { "ret": 非0值 }, "errMsg": { ... } }
      const baseRet = result?.baseResponse?.ret ?? result?.error_code ?? -1;
      const errMsg = result?.baseResponse?.errMsg ?? result?.error_message ?? result?.errMsg;
      const listRet = result?.list?.[0]?.ret;

      // 统一返回格式
      return {
        err_code: listRet !== undefined ? listRet : baseRet,
        err_msg: errMsg,
        data: result.data ?? result,
      };
    } catch (err) {
      this.log(`juhe: GuidRequest failed: ${String(err)}`);
      throw err;
    }
  }

  /**
   * 设置回调 URL
   */
  async setNotifyUrl(notifyUrl: string): Promise<boolean> {
    try {
      const result = await this.guidRequest({
        path: "/client/set_notify_url",
        data: {
          guid: this.config.guid,
          notify_url: notifyUrl,
        },
      });

      return result.err_code === 0;
    } catch (err) {
      this.log(`juhe: setNotifyUrl failed: ${String(err)}`);
      return false;
    }
  }

  /**
   * 发送文本消息
   * API: /msg/send_text
   *
   * 企微使用 conversation_id，个微使用 to_username
   */
  async sendText(to: string, content: string): Promise<{ err_code: number; err_msg?: string }> {
    const data: Record<string, any> = {
      guid: this.config.guid,
      content,
    };

    // 根据类型选择目标字段
    if (this.config.type === "wechat") {
      // 个微使用 to_username
      data.to_username = to;
    } else {
      // 企微使用 conversation_id
      data.conversation_id = to;
    }

    return this.guidRequest({
      path: "/msg/send_text",
      data,
    });
  }

  /**
   * 发送图片消息
   */
  async sendImage(to: string, imageUrl: string): Promise<{ err_code: number; err_msg?: string }> {
    return this.guidRequest({
      path: "/msg/send",
      data: {
        guid: this.config.guid,
        to,
        type: 3, // 图片消息
        content: imageUrl,
      },
    });
  }

  /**
   * 发送文件消息
   */
  async sendFile(to: string, fileUrl: string, fileName?: string): Promise<{ err_code: number; err_msg?: string }> {
    return this.guidRequest({
      path: "/msg/send",
      data: {
        guid: this.config.guid,
        to,
        type: 6, // 文件消息
        content: JSON.stringify({ url: fileUrl, file_name: fileName }),
      },
    });
  }

  /**
   * 获取消息列表
   */
  async getMessageList(params: {
    uin: string;
    objectId: string;
    ltId?: number;
    limit?: number;
  }): Promise<{ err_code: number; list?: any[]; err_msg?: string }> {
    const { uin, objectId, ltId = 0, limit = 50 } = params;

    return this.guidRequest({
      path: "/open/GetMsgList",
      data: {
        app_key: this.config.appKey,
        app_secret: this.config.appSecret,
        uin,
        object_id: objectId,
        lt_id: ltId,
        limit,
      },
    });
  }

  /**
   * 创建客户端实例
   */
  static create(config: JuheConfig, log: (msg: string) => void): JuheClient {
    return new JuheClient(config, log);
  }
}

/**
 * 导出工厂函数
 */
export function createJuheClient(config: JuheConfig): JuheClient {
  return JuheClient.create(config, console.log);
}
