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

  // 如果配置了代理，创建自定义 fetch
  const customFetch = proxyUrl
    ? async (url: RequestInfo | URL, init?: RequestInit) => {
        const dispatcher = new ProxyAgent({
          uri: proxyUrl,
          requestTls: { rejectUnauthorized: false },
        });
        return undiciFetch(url.toString(), {
          ...init,
          dispatcher,
        } as any) as unknown as Response;
      }
    : undefined;

  return new Anthropic({
    apiKey,
    baseURL: process.env.XHS_ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL,
    fetch: customFetch,
  });
}

/**
 * 生成用户 ID（用于 metadata）
 */
export function generateUserId(): string {
  return `user_${Math.random().toString(36).substring(2)}${Date.now()}`;
}
