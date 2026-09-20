import type { AppConfig, ConfigSection } from '../types';
import { DEFAULT_CONFIG } from '../types';

/**
 * 每个分块包含的配置字段
 */
export const SECTION_FIELDS: Record<ConfigSection, (keyof AppConfig)[]> = {
  apiKey: ['apiKey'],
  model: ['model'],
  parameters: ['temperature', 'maxTokens'],
};

/**
 * 配置分块的展示顺序
 */
export const CONFIG_SECTIONS: ConfigSection[] = ['apiKey', 'model', 'parameters'];

/**
 * 每个分块的默认值
 */
const SECTION_DEFAULTS: Record<ConfigSection, Partial<AppConfig>> = {
  apiKey: { apiKey: DEFAULT_CONFIG.apiKey },
  model: { model: DEFAULT_CONFIG.model },
  parameters: {
    temperature: DEFAULT_CONFIG.temperature,
    maxTokens: DEFAULT_CONFIG.maxTokens,
  },
};

/**
 * 取某个分块的默认值
 */
export function getSectionDefaults(section: ConfigSection): Partial<AppConfig> {
  return SECTION_DEFAULTS[section];
}

/**
 * 比较两份配置在某个分块上的值是否一致
 */
export function isSectionEqual(
  section: ConfigSection,
  a: AppConfig,
  b: AppConfig
): boolean {
  return SECTION_FIELDS[section].every((field) => a[field] === b[field]);
}
