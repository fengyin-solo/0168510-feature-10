import { create } from 'zustand';
import type { AppConfig, ConfigSection, ConfigValidation } from '../types';
import { DEFAULT_CONFIG, CONFIG_SECTION_FIELDS } from '../types';
import { saveConfig, loadConfig } from '../services/storage';
import { validateConfig } from '../utils/validators';

/** 取某个区块的默认字段值 */
function pickSectionDefaults(section: ConfigSection): Partial<AppConfig> {
  return Object.fromEntries(
    CONFIG_SECTION_FIELDS[section].map((field) => [field, DEFAULT_CONFIG[field]])
  ) as Partial<AppConfig>;
}

interface ConfigState {
  /** 实际生效的配置（只有保存成功或重置后才会变化） */
  config: AppConfig;
  /** 配置面板里的草稿，未保存的修改只体现在这里 */
  draft: AppConfig;
  /** 生效配置是否完整可用（决定能否发送消息） */
  isValid: boolean;
  /** 草稿的校验错误（按字段写明原因） */
  errors: ConfigValidation['errors'];
  /** 是否已初始化 */
  initialized: boolean;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 更新草稿（不持久化，保存后才生效） */
  updateDraft: (updates: Partial<AppConfig>) => void;
  /** 校验并保存草稿；成功返回 true，失败返回 false 并在 errors 中写明原因 */
  saveDraft: () => boolean;
  /** 放弃草稿，恢复为实际生效的配置 */
  discardDraft: () => void;
  /** 整块重置为默认配置（立即生效并持久化） */
  resetConfig: () => void;
  /** 只重置某个区块为默认值，其他区块不变（立即生效并持久化） */
  resetSection: (section: ConfigSection) => void;
  /** 某个区块的草稿是否与实际生效的配置不一致（即改动未保存） */
  isSectionDirty: (section: ConfigSection) => boolean;
  /** 是否存在未保存的修改 */
  isDirty: () => boolean;
}

type ConfigStore = ConfigState & ConfigActions;

export const useConfigStore = create<ConfigStore>((set, get) => ({
  // Initial state
  config: DEFAULT_CONFIG,
  draft: DEFAULT_CONFIG,
  isValid: false,
  errors: {},
  initialized: false,

  // Actions
  initConfig: () => {
    const loadedConfig = loadConfig();
    const validation = validateConfig(loadedConfig);

    set({
      config: loadedConfig,
      draft: loadedConfig,
      isValid: validation.isValid,
      errors: validation.errors,
      initialized: true,
    });
  },

  updateDraft: (updates) => {
    const { draft } = get();
    const newDraft = { ...draft, ...updates };

    // 只更新草稿并即时校验，不触碰生效配置，也不写入 localStorage
    set({
      draft: newDraft,
      errors: validateConfig(newDraft).errors,
    });
  },

  saveDraft: () => {
    const { draft } = get();
    const validation = validateConfig(draft);

    // 参数超出范围或组合不成立时不允许保存，原因写入 errors
    if (!validation.isValid) {
      set({ errors: validation.errors });
      return false;
    }

    try {
      saveConfig(draft);
    } catch (error) {
      console.error('Failed to save config:', error);
      return false;
    }

    set({
      config: draft,
      isValid: true,
      errors: {},
    });
    return true;
  },

  discardDraft: () => {
    const { config } = get();

    set({
      draft: config,
      errors: validateConfig(config).errors,
    });
  },

  resetConfig: () => {
    try {
      saveConfig(DEFAULT_CONFIG);
    } catch (error) {
      console.error('Failed to save default config:', error);
    }

    set({
      config: DEFAULT_CONFIG,
      draft: DEFAULT_CONFIG,
      isValid: false,
      errors: {},
    });
  },

  resetSection: (section) => {
    const { config, draft } = get();
    const defaults = pickSectionDefaults(section);

    // 只覆盖该区块的字段，其他区块的生效值与草稿都保持不变
    const newConfig = { ...config, ...defaults };
    const newDraft = { ...draft, ...defaults };

    try {
      saveConfig(newConfig);
    } catch (error) {
      console.error('Failed to save config:', error);
    }

    set({
      config: newConfig,
      draft: newDraft,
      isValid: validateConfig(newConfig).isValid,
      errors: validateConfig(newDraft).errors,
    });
  },

  isSectionDirty: (section) => {
    const { config, draft } = get();
    return CONFIG_SECTION_FIELDS[section].some((field) => draft[field] !== config[field]);
  },

  isDirty: () => {
    const { isSectionDirty } = get();
    return (Object.keys(CONFIG_SECTION_FIELDS) as ConfigSection[]).some(isSectionDirty);
  },
}));
