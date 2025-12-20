import Anthropic from '@anthropic-ai/sdk';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

/**
 * 创建配置好的 Anthropic 客户端
 */
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 未配置');
  }

  const proxyUrl = process.env.PROXY_URL;
  const baseURL = process.env.XHS_ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL;

  // 调试日志 - 输出当前配置（隐藏敏感信息）
  console.log('[Anthropic] 客户端配置:', {
    hasApiKey: !!apiKey,
    apiKeyPrefix: apiKey.substring(0, 10) + '...',
    baseURL: baseURL || '(默认)',
    proxyUrl: proxyUrl ? `${proxyUrl.split('@').pop()}` : '(无代理)',
  });

  // 如果配置了代理，创建自定义 fetch
  const customFetch = proxyUrl
    ? async (url: RequestInfo | URL, init?: RequestInit) => {
        console.log('[Anthropic] 使用代理请求:', url.toString().substring(0, 50) + '...');
        try {
          const dispatcher = new ProxyAgent({
            uri: proxyUrl,
            requestTls: { rejectUnauthorized: false },
          });
          const response = await undiciFetch(url.toString(), {
            ...init,
            dispatcher,
          } as any);
          console.log('[Anthropic] 代理请求成功, status:', response.status);
          return response as unknown as Response;
        } catch (err) {
          console.error('[Anthropic] 代理请求失败:', err);
          throw err;
        }
      }
    : undefined;

  return new Anthropic({
    apiKey,
    baseURL,
    fetch: customFetch,
  });
}

/**
 * 生成用户 ID（用于 metadata）
 */
export function generateUserId(): string {
  return `user_${Math.random().toString(36).substring(2)}${Date.now()}`;
}
