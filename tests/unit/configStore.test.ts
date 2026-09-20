import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useConfigStore } from '../../src/stores/configStore';
import { DEFAULT_CONFIG } from '../../src/types';

const VALID_API_KEY = 'sk-1234567890abcdef';

// 测试环境为 node，storage.ts 依赖 localStorage，这里提供最小实现
beforeAll(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => void store.clear(),
    },
    configurable: true,
  });
});

describe('configStore 配置面板口径', () => {
  beforeEach(() => {
    localStorage.clear();
    // 重置 store 到初始状态
    useConfigStore.setState({
      config: DEFAULT_CONFIG,
      draft: DEFAULT_CONFIG,
      isValid: false,
      errors: {},
      initialized: false,
    });
    useConfigStore.getState().initConfig();
    useConfigStore.getState().syncDraft();
  });

  it('编辑只改草稿，不影响已生效配置', () => {
    useConfigStore.getState().updateDraft({ temperature: 1.5 });
    expect(useConfigStore.getState().draft.temperature).toBe(1.5);
    expect(useConfigStore.getState().config.temperature).toBe(DEFAULT_CONFIG.temperature);
  });

  it('保存成功后草稿才成为生效配置', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, temperature: 1.2 });
    const result = useConfigStore.getState().saveDraft();
    expect(result.success).toBe(true);
    expect(useConfigStore.getState().config.apiKey).toBe(VALID_API_KEY);
    expect(useConfigStore.getState().config.temperature).toBe(1.2);
    expect(useConfigStore.getState().isValid).toBe(true);
  });

  it('temperature 超出 0-2 范围时不允许保存并给出原因', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, temperature: 3 });
    const result = useConfigStore.getState().saveDraft();
    expect(result.success).toBe(false);
    expect(result.errors.temperature).toContain('0-2');
    // 生效配置不变
    expect(useConfigStore.getState().config.temperature).toBe(DEFAULT_CONFIG.temperature);
  });

  it('maxTokens 不是正整数时不允许保存并给出原因', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, maxTokens: 0 });
    const result = useConfigStore.getState().saveDraft();
    expect(result.success).toBe(false);
    expect(result.errors.maxTokens).toBeTruthy();
  });

  it('maxTokens 超过所选模型最大上下文时组合不成立，不允许保存', () => {
    useConfigStore.getState().updateDraft({
      apiKey: VALID_API_KEY,
      model: 'Qwen/Qwen2.5-72B-Instruct',
      maxTokens: 40000,
    });
    const result = useConfigStore.getState().saveDraft();
    expect(result.success).toBe(false);
    expect(result.errors.maxTokens).toContain('32,000');
  });

  it('API 密钥缺失或格式错误时不允许保存并给出原因', () => {
    expect(useConfigStore.getState().saveDraft().errors.apiKey).toContain('请输入');

    useConfigStore.getState().updateDraft({ apiKey: 'short' });
    const result = useConfigStore.getState().saveDraft();
    expect(result.success).toBe(false);
    expect(result.errors.apiKey).toContain('格式');
  });

  it('单块重置只改对应块，其他块不变', () => {
    useConfigStore.getState().updateDraft({
      apiKey: VALID_API_KEY,
      model: 'Qwen/Qwen2.5-32B-Instruct',
      temperature: 1.9,
      maxTokens: 4096,
    });

    useConfigStore.getState().resetDraftSection('parameters');

    const { draft } = useConfigStore.getState();
    expect(draft.temperature).toBe(DEFAULT_CONFIG.temperature);
    expect(draft.maxTokens).toBe(DEFAULT_CONFIG.maxTokens);
    expect(draft.apiKey).toBe(VALID_API_KEY);
    expect(draft.model).toBe('Qwen/Qwen2.5-32B-Instruct');
  });

  it('单块重置不立即生效，保存后才生效', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, temperature: 1.9 });
    useConfigStore.getState().saveDraft();

    useConfigStore.getState().updateDraft({ temperature: 0.3 });
    useConfigStore.getState().resetDraftSection('parameters');
    // 已生效的仍是 1.9
    expect(useConfigStore.getState().config.temperature).toBe(1.9);
    // 草稿已回到默认 0.7
    expect(useConfigStore.getState().draft.temperature).toBe(0.7);

    const result = useConfigStore.getState().saveDraft();
    expect(result.success).toBe(true);
    expect(useConfigStore.getState().config.temperature).toBe(0.7);
  });

  it('整块重置恢复全部默认并立即生效', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, temperature: 1.9 });
    useConfigStore.getState().saveDraft();

    useConfigStore.getState().resetConfig();
    expect(useConfigStore.getState().config).toEqual(DEFAULT_CONFIG);
    expect(useConfigStore.getState().draft).toEqual(DEFAULT_CONFIG);
  });

  it('保存后再改、再保存，可以随时回到默认的那一份', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, temperature: 1.9 });
    useConfigStore.getState().saveDraft();

    useConfigStore.getState().resetDraftSection('parameters');
    useConfigStore.getState().saveDraft();
    expect(useConfigStore.getState().config.temperature).toBe(DEFAULT_CONFIG.temperature);
    // 密钥等其他字段仍在
    expect(useConfigStore.getState().config.apiKey).toBe(VALID_API_KEY);
  });

  it('关闭面板再打开（syncDraft），面板取值与已生效配置一致，丢弃未保存修改', () => {
    useConfigStore.getState().updateDraft({ apiKey: VALID_API_KEY, temperature: 1.0 });
    useConfigStore.getState().saveDraft();

    useConfigStore.getState().updateDraft({ temperature: 0.1 });
    // 未保存直接关闭，再打开
    useConfigStore.getState().syncDraft();

    expect(useConfigStore.getState().draft).toEqual(useConfigStore.getState().config);
    expect(useConfigStore.getState().draft.temperature).toBe(1.0);
  });
});
