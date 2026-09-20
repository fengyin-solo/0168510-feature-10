import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  validateAPIKey,
  validateTemperature,
  validateMaxTokens,
} from '../../src/utils/validators';
import { DEFAULT_CONFIG, AVAILABLE_MODELS } from '../../src/types';

const VALID_KEY = 'sk-test_key-12345';

function validConfig(overrides: Partial<typeof DEFAULT_CONFIG> = {}) {
  return { ...DEFAULT_CONFIG, apiKey: VALID_KEY, ...overrides };
}

describe('validateConfig - 参数范围', () => {
  it('合法配置通过', () => {
    const result = validateConfig(validConfig());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('temperature 超出 0-2 时不通过并写明原因', () => {
    expect(validateConfig(validConfig({ temperature: 2.1 })).errors.temperature).toBeTruthy();
    expect(validateConfig(validConfig({ temperature: -0.1 })).errors.temperature).toBeTruthy();
    expect(validateConfig(validConfig({ temperature: 0 })).isValid).toBe(true);
    expect(validateConfig(validConfig({ temperature: 2 })).isValid).toBe(true);
  });

  it('maxTokens 不是正整数时不通过并写明原因', () => {
    expect(validateConfig(validConfig({ maxTokens: 0 })).errors.maxTokens).toBeTruthy();
    expect(validateConfig(validConfig({ maxTokens: -5 })).errors.maxTokens).toBeTruthy();
    expect(validateConfig(validConfig({ maxTokens: 1.5 })).errors.maxTokens).toBeTruthy();
  });

  it('API 密钥为空或格式非法时不通过并写明原因', () => {
    expect(validateConfig(validConfig({ apiKey: '' })).errors.apiKey).toBeTruthy();
    expect(validateConfig(validConfig({ apiKey: 'short' })).errors.apiKey).toBeTruthy();
    expect(validateConfig(validConfig({ apiKey: 'has space in key' })).errors.apiKey).toBeTruthy();
  });
});

describe('validateConfig - 组合校验', () => {
  const qwen32b = 'Qwen/Qwen2.5-32B-Instruct'; // maxContext 32000
  const deepseek = 'deepseek-ai/DeepSeek-V3'; // maxContext 64000

  it('maxTokens 超过所选模型最大上下文时不通过并写明原因', () => {
    const result = validateConfig(validConfig({ model: qwen32b, maxTokens: 40000 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.maxTokens).toContain('最大上下文');
  });

  it('maxTokens 等于模型最大上下文时通过', () => {
    expect(validateConfig(validConfig({ model: qwen32b, maxTokens: 32000 })).isValid).toBe(true);
  });

  it('同一 maxTokens 在不同模型下结论不同', () => {
    expect(validateConfig(validConfig({ model: qwen32b, maxTokens: 40000 })).isValid).toBe(false);
    expect(validateConfig(validConfig({ model: deepseek, maxTokens: 40000 })).isValid).toBe(true);
  });

  it('模型不在可用列表中时不通过并写明原因', () => {
    const result = validateConfig(validConfig({ model: 'unknown/model' }));
    expect(result.isValid).toBe(false);
    expect(result.errors.model).toBeTruthy();
  });

  it('可用列表中的每个模型默认配置都能通过', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(validateConfig(validConfig({ model: model.id })).isValid).toBe(true);
    }
  });
});

describe('基础校验函数', () => {
  it('validateAPIKey', () => {
    expect(validateAPIKey(VALID_KEY)).toBe(true);
    expect(validateAPIKey('')).toBe(false);
    expect(validateAPIKey('abc')).toBe(false);
    expect(validateAPIKey('key with space!!')).toBe(false);
  });

  it('validateTemperature', () => {
    expect(validateTemperature(0)).toBe(true);
    expect(validateTemperature(2)).toBe(true);
    expect(validateTemperature(2.5)).toBe(false);
    expect(validateTemperature(NaN)).toBe(false);
  });

  it('validateMaxTokens', () => {
    expect(validateMaxTokens(1)).toBe(true);
    expect(validateMaxTokens(0)).toBe(false);
    expect(validateMaxTokens(3.14)).toBe(false);
    expect(validateMaxTokens(Infinity)).toBe(false);
  });
});
