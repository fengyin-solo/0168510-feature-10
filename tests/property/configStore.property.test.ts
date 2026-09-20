import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useConfigStore } from '../../src/stores/configStore';
import {
  DEFAULT_CONFIG,
  CONFIG_SECTION_FIELDS,
  AVAILABLE_MODELS,
} from '../../src/types';
import type { AppConfig, ConfigSection } from '../../src/types';
import { loadConfig } from '../../src/services/storage';

// 任意合法 API Key（字母数字下划线连字符，至少 10 位）
const validApiKeyArb = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')), { minLength: 10, maxLength: 40 })
  .map((chars) => chars.join(''));

// 任意合法配置
const validConfigArb: fc.Arbitrary<AppConfig> = fc.record({
  apiKey: validApiKeyArb,
  model: fc.constantFrom(...AVAILABLE_MODELS.map((m) => m.id)),
  temperature: fc.double({ min: 0, max: 2, noNaN: true }),
  maxTokens: fc.integer({ min: 1, max: 64000 }),
  baseUrl: fc.constant(DEFAULT_CONFIG.baseUrl),
}).filter((config) => {
  const model = AVAILABLE_MODELS.find((m) => m.id === config.model);
  return model?.maxContext === undefined || config.maxTokens <= model.maxContext;
});

const sectionArb: fc.Arbitrary<ConfigSection> = fc.constantFrom('api', 'model', 'parameters');

beforeEach(() => {
  useConfigStore.setState({
    config: DEFAULT_CONFIG,
    draft: DEFAULT_CONFIG,
    isValid: false,
    errors: {},
    initialized: false,
  });
});

describe('配置生效口径 - 属性测试', () => {
  it('未保存的草稿修改永远不会影响生效配置与持久化内容', () => {
    fc.assert(
      fc.property(validConfigArb, validConfigArb, (saved, edits) => {
        const store = useConfigStore.getState();
        store.updateDraft(saved);
        store.saveDraft();

        useConfigStore.getState().updateDraft(edits);

        const state = useConfigStore.getState();
        // 生效配置仍是保存的那一份
        expect(state.config).toEqual(saved);
        // localStorage 里也还是保存的那一份
        expect(loadConfig()).toEqual(saved);
      })
    );
  });

  it('合法草稿保存后，生效配置、草稿与持久化内容三者一致', () => {
    fc.assert(
      fc.property(validConfigArb, (config) => {
        const store = useConfigStore.getState();
        store.updateDraft(config);

        expect(useConfigStore.getState().saveDraft()).toBe(true);

        const state = useConfigStore.getState();
        expect(state.config).toEqual(config);
        expect(state.draft).toEqual(config);
        expect(state.isDirty()).toBe(false);
        expect(loadConfig()).toEqual(config);
      })
    );
  });

  it('分块重置只影响该区块，其他区块的生效值与草稿都不变', () => {
    fc.assert(
      fc.property(validConfigArb, validConfigArb, sectionArb, (saved, edits, section) => {
        const store = useConfigStore.getState();
        store.updateDraft(saved);
        store.saveDraft();
        useConfigStore.getState().updateDraft(edits);

        const before = useConfigStore.getState();
        useConfigStore.getState().resetSection(section);
        const after = useConfigStore.getState();

        const sectionFields = CONFIG_SECTION_FIELDS[section];
        const otherFields = (Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]).filter(
          (f) => !sectionFields.includes(f)
        );

        // 该区块回到默认值（生效配置与草稿都是）
        for (const field of sectionFields) {
          expect(after.config[field]).toEqual(DEFAULT_CONFIG[field]);
          expect(after.draft[field]).toEqual(DEFAULT_CONFIG[field]);
        }
        // 其他区块的生效值与草稿保持原样
        for (const field of otherFields) {
          expect(after.config[field]).toEqual(before.config[field]);
          expect(after.draft[field]).toEqual(before.draft[field]);
        }
        // 该区块不再有未保存的改动
        expect(after.isSectionDirty(section)).toBe(false);
        // 持久化内容与生效配置一致
        expect(loadConfig()).toEqual(after.config);
      })
    );
  });

  it('超出范围的 temperature 一律不允许保存，生效配置不变', () => {
    const outOfRangeTemp = fc.oneof(
      fc.double({ min: 2.0000001, max: 1e6, noNaN: true }),
      fc.double({ min: -1e6, max: -0.0000001, noNaN: true })
    );

    fc.assert(
      fc.property(validConfigArb, outOfRangeTemp, (saved, badTemp) => {
        const store = useConfigStore.getState();
        store.updateDraft(saved);
        store.saveDraft();

        useConfigStore.getState().updateDraft({ temperature: badTemp });

        expect(useConfigStore.getState().saveDraft()).toBe(false);

        const state = useConfigStore.getState();
        expect(state.config).toEqual(saved);
        expect(state.errors.temperature).toBeTruthy();
        expect(loadConfig()).toEqual(saved);
      })
    );
  });

  it('maxTokens 超过所选模型最大上下文（组合不成立）一律不允许保存', () => {
    const modelArb = fc.constantFrom(...AVAILABLE_MODELS);
    const comboArb = fc
      .tuple(modelArb, fc.integer({ min: 1, max: 200000 }))
      .filter(([model, maxTokens]) => model.maxContext !== undefined && maxTokens > model.maxContext);

    fc.assert(
      fc.property(validApiKeyArb, comboArb, (apiKey, [model, maxTokens]) => {
        const store = useConfigStore.getState();
        store.updateDraft({ ...DEFAULT_CONFIG, apiKey, model: model.id, maxTokens });

        expect(useConfigStore.getState().saveDraft()).toBe(false);

        const state = useConfigStore.getState();
        expect(state.errors.maxTokens).toBeTruthy();
        expect(state.config).toEqual(DEFAULT_CONFIG);
      })
    );
  });

  it('放弃草稿后，面板取值始终与实际生效的配置一致', () => {
    fc.assert(
      fc.property(validConfigArb, validConfigArb, (saved, edits) => {
        const store = useConfigStore.getState();
        store.updateDraft(saved);
        store.saveDraft();

        useConfigStore.getState().updateDraft(edits);
        useConfigStore.getState().discardDraft();

        const state = useConfigStore.getState();
        expect(state.draft).toEqual(state.config);
        expect(state.isDirty()).toBe(false);
      })
    );
  });
});
