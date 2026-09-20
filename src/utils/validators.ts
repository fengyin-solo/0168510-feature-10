import type { AppConfig, ConfigValidation } from '../types';
import { AVAILABLE_MODELS } from '../types';

/**
 * 验证 API 密钥格式
 * @param apiKey API 密钥
 * @returns 是否有效
 */
export function validateAPIKey(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  const trimmed = apiKey.trim();
  
  // API Key 应该是非空字符串，长度至少 10 个字符
  if (trimmed.length < 10) {
    return false;
  }
  
  // 检查是否只包含有效字符（字母、数字、下划线、连字符）
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(trimmed);
}

/**
 * 验证 temperature 参数
 * @param temperature 温度值
 * @returns 是否有效（0-2 范围内）
 */
export function validateTemperature(temperature: number): boolean {
  if (typeof temperature !== 'number') {
    return false;
  }
  
  if (Number.isNaN(temperature) || !Number.isFinite(temperature)) {
    return false;
  }
  
  return temperature >= 0 && temperature <= 2;
}

/**
 * 验证 max_tokens 参数
 * @param maxTokens 最大 Token 数
 * @returns 是否有效（正整数）
 */
export function validateMaxTokens(maxTokens: number): boolean {
  if (typeof maxTokens !== 'number') {
    return false;
  }
  
  if (Number.isNaN(maxTokens) || !Number.isFinite(maxTokens)) {
    return false;
  }
  
  return Number.isInteger(maxTokens) && maxTokens > 0;
}

/**
 * 验证消息内容
 * @param content 消息内容
 * @returns 是否有效（非空白字符串）
 */
export function validateMessageContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }
  
  return content.trim().length > 0;
}

/**
 * 验证 URL 格式
 * @param url URL 字符串
 * @returns 是否有效
 */
export function validateURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 验证完整配置
 * @param config 应用配置
 * @returns 验证结果（errors 中按字段写明不通过的原因）
 */
export function validateConfig(config: Partial<AppConfig>): ConfigValidation {
  const errors: ConfigValidation['errors'] = {};

  // 验证 API Key
  if (config.apiKey !== undefined && !validateAPIKey(config.apiKey)) {
    errors.apiKey = 'API 密钥格式无效，请检查后重试';
  }

  // 验证模型是否在可用列表中
  const model = config.model !== undefined
    ? AVAILABLE_MODELS.find((m) => m.id === config.model)
    : undefined;
  if (config.model !== undefined && !model) {
    errors.model = '所选模型不在可用模型列表中';
  }

  // 验证 temperature
  if (config.temperature !== undefined && !validateTemperature(config.temperature)) {
    errors.temperature = 'Temperature 必须在 0-2 范围内';
  }

  // 验证 maxTokens
  if (config.maxTokens !== undefined) {
    if (!validateMaxTokens(config.maxTokens)) {
      errors.maxTokens = 'Max Tokens 必须是正整数';
    } else if (model?.maxContext !== undefined && config.maxTokens > model.maxContext) {
      // 组合校验：maxTokens 不能超过所选模型支持的最大上下文
      errors.maxTokens = `Max Tokens 超过所选模型支持的最大上下文（${model.maxContext.toLocaleString()}），请调低数值或更换模型`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * 清理和规范化 API Key
 * @param apiKey 原始 API Key
 * @returns 清理后的 API Key
 */
export function sanitizeAPIKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') {
    return '';
  }
  return apiKey.trim();
}

/**
 * 限制 temperature 到有效范围
 * @param temperature 原始值
 * @returns 限制后的值
 */
export function clampTemperature(temperature: number): number {
  if (typeof temperature !== 'number' || Number.isNaN(temperature)) {
    return 0.7; // 默认值
  }
  return Math.max(0, Math.min(2, temperature));
}

/**
 * 限制 maxTokens 到有效范围
 * @param maxTokens 原始值
 * @param max 最大允许值
 * @returns 限制后的值
 */
export function clampMaxTokens(maxTokens: number, max: number = 8192): number {
  if (typeof maxTokens !== 'number' || Number.isNaN(maxTokens)) {
    return 2048; // 默认值
  }
  return Math.max(1, Math.min(max, Math.floor(maxTokens)));
}
