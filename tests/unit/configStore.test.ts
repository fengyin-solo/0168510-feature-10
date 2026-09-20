import { describe, it, expect, beforeEach } from 'vitest';
import { useConfigStore } from '../../src/stores/configStore';
import { useChatStore } from '../../src/stores/chatStore';
import { DEFAULT_CONFIG } from '../../src/types';
import { loadConfig, saveConfig } from '../../src/services/storage';

const VALID_KEY = 'sk-test_key-12345';
const QWEN_32B = 'Qwen/Qwen2.5-32B-Instruct'; // maxContext 32000

function validDraft(overrides: Partial<typeof DEFAULT_CONFIG> = {}) {
  return { ...DEFAULT_CONFIG, apiKey: VALID_KEY, ...overrides };
}

beforeEach(() => {
  useConfigStore.setState({
    config: DEFAULT_CONFIG,
    draft: DEFAULT_CONFIG,
    isValid: false,
    errors: {},
    initialized: false,
  });
  useChatStore.setState({
    conversations: [],
    activeConversationId: null,
    initialized: false,
  });
});

describe('草稿与生效配置分离', () => {
  it('面板里的修改在保存前不影响生效配置，也不写入 localStorage', () => {
    const store = useConfigStore.getState();
    store.initConfig();

    store.updateDraft({ apiKey: VALID_KEY, temperature: 1.5 });

    const state = useConfigStore.getState();
    // 草稿已更新
    expect(state.draft.apiKey).toBe(VALID_KEY);
    expect(state.draft.temperature).toBe(1.5);
    // 生效配置不变
    expect(state.config.apiKey).toBe(DEFAULT_CONFIG.apiKey);
    expect(state.config.temperature).toBe(DEFAULT_CONFIG.temperature);
    // 不持久化
    expect(loadConfig().apiKey).toBe(DEFAULT_CONFIG.apiKey);
    expect(loadConfig().temperature).toBe(DEFAULT_CONFIG.temperature);
  });

  it('每个区块都能标明这次改动是否已保存', () => {
    const store = useConfigStore.getState();
    store.initConfig();

    expect(store.isSectionDirty('api')).toBe(false);
    expect(store.isSectionDirty('model')).toBe(false);
    expect(store.isSectionDirty('parameters')).toBe(false);
    expect(store.isDirty()).toBe(false);

    store.updateDraft({ temperature: 1.5 });

    expect(useConfigStore.getState().isSectionDirty('parameters')).toBe(true);
    expect(useConfigStore.getState().isSectionDirty('api')).toBe(false);
    expect(useConfigStore.getState().isSectionDirty('model')).toBe(false);
    expect(useConfigStore.getState().isDirty()).toBe(true);
  });

  it('保存成功后生效配置与面板取值一致，并持久化', () => {
    const store = useConfigStore.getState();
    store.initConfig();

    store.updateDraft(validDraft({ temperature: 1.2, maxTokens: 4096 }));
    expect(useConfigStore.getState().saveDraft()).toBe(true);

    const state = useConfigStore.getState();
    expect(state.config).toEqual(state.draft);
    expect(state.isDirty()).toBe(false);
    expect(state.isValid).toBe(true);

    const persisted = loadConfig();
    expect(persisted.temperature).toBe(1.2);
    expect(persisted.maxTokens).toBe(4096);
    expect(persisted.apiKey).toBe(VALID_KEY);
  });
});

describe('参数非法或组合不成立时不允许保存并写明原因', () => {
  beforeEach(() => {
    useConfigStore.getState().initConfig();
  });

  it('temperature 超出 0-2 范围时拒绝保存', () => {
    const store = useConfigStore.getState();
    store.updateDraft(validDraft({ temperature: 3 }));

    expect(useConfigStore.getState().saveDraft()).toBe(false);

    const state = useConfigStore.getState();
    expect(state.errors.temperature).toBeTruthy();
    // 生效配置与持久化内容都不变
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('maxTokens 不是正整数时拒绝保存', () => {
    const store = useConfigStore.getState();
    store.updateDraft(validDraft({ maxTokens: -100 }));

    expect(useConfigStore.getState().saveDraft()).toBe(false);
    expect(useConfigStore.getState().errors.maxTokens).toBeTruthy();
    expect(useConfigStore.getState().config).toEqual(DEFAULT_CONFIG);
  });

  it('maxTokens 超过所选模型最大上下文（组合不成立）时拒绝保存并写明原因', () => {
    const store = useConfigStore.getState();
    store.updateDraft(validDraft({ model: QWEN_32B, maxTokens: 40000 }));

    expect(useConfigStore.getState().saveDraft()).toBe(false);

    const state = useConfigStore.getState();
    expect(state.errors.maxTokens).toContain('最大上下文');
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('maxTokens 未超过所选模型最大上下文时允许保存', () => {
    const store = useConfigStore.getState();
    store.updateDraft(validDraft({ model: QWEN_32B, maxTokens: 32000 }));

    expect(useConfigStore.getState().saveDraft()).toBe(true);
    expect(useConfigStore.getState().config.maxTokens).toBe(32000);
  });

  it('API 密钥格式无效时拒绝保存', () => {
    const store = useConfigStore.getState();
    store.updateDraft({ ...validDraft(), apiKey: 'short' });

    expect(useConfigStore.getState().saveDraft()).toBe(false);
    expect(useConfigStore.getState().errors.apiKey).toBeTruthy();
  });

  it('模型不在可用列表中时拒绝保存', () => {
    const store = useConfigStore.getState();
    store.updateDraft(validDraft({ model: 'not-a-model' }));

    expect(useConfigStore.getState().saveDraft()).toBe(false);
    expect(useConfigStore.getState().errors.model).toBeTruthy();
  });
});

describe('分块重置互不影响', () => {
  beforeEach(() => {
    const store = useConfigStore.getState();
    store.initConfig();
    // 先保存一份自定义配置
    store.updateDraft(
      validDraft({ model: QWEN_32B, temperature: 1.5, maxTokens: 4096 })
    );
    useConfigStore.getState().saveDraft();
  });

  it('只重置参数调整区块时，密钥与模型区块不变', () => {
    const store = useConfigStore.getState();
    store.resetSection('parameters');

    const state = useConfigStore.getState();
    // 参数区块回到默认值（立即生效）
    expect(state.config.temperature).toBe(DEFAULT_CONFIG.temperature);
    expect(state.config.maxTokens).toBe(DEFAULT_CONFIG.maxTokens);
    expect(state.draft.temperature).toBe(DEFAULT_CONFIG.temperature);
    // 其他区块不变
    expect(state.config.apiKey).toBe(VALID_KEY);
    expect(state.config.model).toBe(QWEN_32B);
    expect(state.draft.apiKey).toBe(VALID_KEY);
    expect(state.draft.model).toBe(QWEN_32B);
    // 持久化内容一致
    const persisted = loadConfig();
    expect(persisted.temperature).toBe(DEFAULT_CONFIG.temperature);
    expect(persisted.apiKey).toBe(VALID_KEY);
    expect(persisted.model).toBe(QWEN_32B);
  });

  it('只重置密钥区块时，模型与参数区块不变', () => {
    const store = useConfigStore.getState();
    store.resetSection('api');

    const state = useConfigStore.getState();
    expect(state.config.apiKey).toBe(DEFAULT_CONFIG.apiKey);
    expect(state.config.model).toBe(QWEN_32B);
    expect(state.config.temperature).toBe(1.5);
    expect(state.config.maxTokens).toBe(4096);
  });

  it('重置某一块时，另一块未保存的草稿改动也不跟着变', () => {
    const store = useConfigStore.getState();
    // 参数区块有未保存的修改
    store.updateDraft({ temperature: 0.1 });

    useConfigStore.getState().resetSection('model');

    const state = useConfigStore.getState();
    // 模型区块被重置
    expect(state.config.model).toBe(DEFAULT_CONFIG.model);
    expect(state.draft.model).toBe(DEFAULT_CONFIG.model);
    // 参数区块的未保存修改保持原样
    expect(state.draft.temperature).toBe(0.1);
    expect(state.isSectionDirty('parameters')).toBe(true);
  });
});

describe('面板取值与实际生效配置对齐', () => {
  it('放弃草稿后（关闭再打开），面板取值与生效配置一致', () => {
    const store = useConfigStore.getState();
    store.initConfig();
    store.updateDraft(validDraft({ temperature: 1.8 }));
    useConfigStore.getState().saveDraft();

    // 未保存的新修改
    useConfigStore.getState().updateDraft({ temperature: 0.3, maxTokens: 512 });
    expect(useConfigStore.getState().isDirty()).toBe(true);

    // 关闭面板（未保存）再打开
    useConfigStore.getState().discardDraft();

    const state = useConfigStore.getState();
    expect(state.draft).toEqual(state.config);
    expect(state.draft.temperature).toBe(1.8);
    expect(state.isDirty()).toBe(false);
  });

  it('切换对话后，面板取值仍与生效配置对得上', () => {
    const store = useConfigStore.getState();
    store.initConfig();
    store.updateDraft(validDraft({ temperature: 1.1 }));
    useConfigStore.getState().saveDraft();

    // 切换对话
    const chat = useChatStore.getState();
    chat.initConversations();
    const first = useChatStore.getState().createConversation('对话一');
    useChatStore.getState().createConversation('对话二');
    useChatStore.getState().setActiveConversation(first);

    const state = useConfigStore.getState();
    expect(state.config.temperature).toBe(1.1);
    expect(state.draft).toEqual(state.config);
    expect(state.isDirty()).toBe(false);
  });
});

describe('重置回默认配置', () => {
  it('整块重置保持原有行为：立即生效并持久化', () => {
    const store = useConfigStore.getState();
    store.initConfig();
    store.updateDraft(validDraft({ temperature: 1.5 }));
    useConfigStore.getState().saveDraft();

    useConfigStore.getState().resetConfig();

    const state = useConfigStore.getState();
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(state.draft).toEqual(DEFAULT_CONFIG);
    expect(state.isValid).toBe(false);
    expect(state.errors).toEqual({});
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('后续操作再改回来时，仍能回到默认的那一份', () => {
    const store = useConfigStore.getState();
    store.initConfig();

    // 改一轮 -> 重置
    store.updateDraft(validDraft({ model: QWEN_32B, temperature: 1.9 }));
    useConfigStore.getState().saveDraft();
    useConfigStore.getState().resetConfig();
    expect(useConfigStore.getState().config).toEqual(DEFAULT_CONFIG);

    // 再改一轮 -> 逐块重置，最终仍回到默认
    useConfigStore.getState().updateDraft(validDraft({ model: QWEN_32B, temperature: 0.2 }));
    useConfigStore.getState().saveDraft();
    useConfigStore.getState().resetSection('api');
    useConfigStore.getState().resetSection('model');
    useConfigStore.getState().resetSection('parameters');

    const state = useConfigStore.getState();
    expect(state.config).toEqual(DEFAULT_CONFIG);
    expect(state.draft).toEqual(DEFAULT_CONFIG);
    expect(state.isDirty()).toBe(false);
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });
});

describe('初始化', () => {
  it('从 localStorage 加载已保存的配置，草稿与生效配置一致', () => {
    const saved = validDraft({ temperature: 0.9, maxTokens: 1024 });
    saveConfig(saved);

    useConfigStore.getState().initConfig();

    const state = useConfigStore.getState();
    expect(state.config).toEqual(saved);
    expect(state.draft).toEqual(saved);
    expect(state.isValid).toBe(true);
    expect(state.initialized).toBe(true);
  });
});
