import { create } from 'zustand';
import type { AppConfig, ConfigSection, ConfigValidation } from '../types';
import { DEFAULT_CONFIG } from '../types';
import { saveConfig, loadConfig } from '../services/storage';
import { validateConfig } from '../utils/validators';
import { getSectionDefaults } from '../utils/configSections';

interface ConfigState {
  /** 已保存、实际生效的配置 */
  config: AppConfig;
  /** 配置面板中正在编辑的草稿（点击保存前不生效） */
  draft: AppConfig;
  /** 已生效配置是否有效 */
  isValid: boolean;
  /** 草稿的验证错误信息 */
  errors: ConfigValidation['errors'];
  /** 是否已初始化 */
  initialized: boolean;
}

interface ConfigActions {
  /** 初始化配置（从 localStorage 加载） */
  initConfig: () => void;
  /** 打开面板：用当前已生效配置同步草稿，丢弃上次未保存的修改 */
  syncDraft: () => void;
  /** 更新草稿中的字段（不会影响实际生效的配置） */
  updateDraft: (updates: Partial<AppConfig>) => void;
  /** 校验并保存草稿；成功后草稿成为生效配置 */
  saveDraft: () => { success: boolean; errors: ConfigValidation['errors'] };
  /** 把草稿中的某一块重置为默认值（不影响其他块，也不会立即生效） */
  resetDraftSection: (section: ConfigSection) => void;
  /** 整块重置：所有配置恢复默认并立即生效（原有功能保持不变） */
  resetConfig: () => void;
  /** 设置 API Key（更新草稿） */
  setAPIKey: (apiKey: string) => void;
  /** 设置模型（更新草稿） */
  setModel: (model: string) => void;
  /** 设置 temperature（更新草稿） */
  setTemperature: (temperature: number) => void;
  /** 设置 maxTokens（更新草稿） */
  setMaxTokens: (maxTokens: number) => void;
}

type ConfigStore = ConfigState & ConfigActions;

function validate(config: AppConfig) {
  const validation = validateConfig(config);
  return { isValid: validation.isValid, errors: validation.errors };
}

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
    const { isValid, errors } = validate(loadedConfig);

    set({
      config: loadedConfig,
      draft: loadedConfig,
      isValid,
      errors,
      initialized: true,
    });
  },

  syncDraft: () => {
    const { config } = get();
    const { errors } = validate(config);

    // 面板每次打开都以实际生效的配置为准
    set({ draft: config, errors });
  },

  updateDraft: (updates) => {
    const { draft } = get();
    const nextDraft = { ...draft, ...updates };
    const { errors } = validate(nextDraft);

    set({ draft: nextDraft, errors });
  },

  saveDraft: () => {
    const { draft } = get();
    const { errors } = validate(draft);
    const success = Object.keys(errors).length === 0;

    if (!success) {
      // 校验不通过：不允许保存，错误原因写入 errors 供面板展示
      set({ errors });
      return { success: false, errors };
    }

    try {
      saveConfig(draft);
    } catch (error) {
      console.error('Failed to save config:', error);
      return {
        success: false,
        errors: { apiKey: '配置保存失败，请稍后重试' },
      };
    }

    set({
      config: draft,
      isValid: true,
      errors: {},
    });

    return { success: true, errors: {} };
  },

  resetDraftSection: (section) => {
    const { draft } = get();
    // 只替换该块的字段，其他块保持当前草稿值不变，且不影响已生效配置
    const nextDraft = { ...draft, ...getSectionDefaults(section) };
    const { errors } = validate(nextDraft);

    set({ draft: nextDraft, errors });
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

  setAPIKey: (apiKey) => {
    get().updateDraft({ apiKey });
  },

  setModel: (model) => {
    get().updateDraft({ model });
  },

  setTemperature: (temperature) => {
    get().updateDraft({ temperature });
  },

  setMaxTokens: (maxTokens) => {
    get().updateDraft({ maxTokens });
  },
}));
