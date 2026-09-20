import { useEffect } from 'react';
import { Drawer, Button, Divider, Tag, Tooltip, message } from 'antd';
import {
  SaveOutlined,
  ReloadOutlined,
  CheckCircleFilled,
  EditFilled,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { APIKeyInput } from './APIKeyInput';
import { ModelSelector } from './ModelSelector';
import { ParameterSlider } from './ParameterSlider';
import { useConfigStore } from '../../stores/configStore';
import { useUIStore } from '../../stores/uiStore';
import type { ConfigSection } from '../../types';
import { isSectionEqual } from '../../utils/configSections';
import './ConfigPanel.css';

const SECTION_TITLES: Record<ConfigSection, string> = {
  apiKey: '密钥',
  model: '模型',
  parameters: '参数调整',
};

/** 校验错误在提示中的展示顺序 */
const ERROR_ORDER: ConfigSection[] = ['apiKey', 'model', 'parameters'];

function SectionStatus({
  dirty,
  invalid,
}: {
  dirty: boolean;
  invalid: boolean;
}) {
  if (invalid) {
    return (
      <Tag icon={<ExclamationCircleFilled />} color="error" className="section-status">
        校验不通过
      </Tag>
    );
  }

  if (dirty) {
    return (
      <Tag icon={<EditFilled />} color="warning" className="section-status">
        未保存
      </Tag>
    );
  }

  return (
    <Tag icon={<CheckCircleFilled />} color="success" className="section-status">
      已保存
    </Tag>
  );
}

function SectionHeader({
  section,
  dirty,
  invalid,
  onReset,
}: {
  section: ConfigSection;
  dirty: boolean;
  invalid: boolean;
  onReset: (section: ConfigSection) => void;
}) {
  return (
    <div className="section-header">
      <h3 className="section-title">{SECTION_TITLES[section]}</h3>
      <div className="section-actions">
        <SectionStatus dirty={dirty} invalid={invalid} />
        <Tooltip title="仅将这一块恢复为默认值（其他块不变），需点击保存后生效">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => onReset(section)}
          >
            恢复默认
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * 配置面板组件
 */
export function ConfigPanel() {
  const {
    config,
    draft,
    errors,
    saveDraft,
    resetConfig,
    resetDraftSection,
    syncDraft,
    updateDraft,
  } = useConfigStore();

  const { configPanelVisible, setConfigPanelVisible, isMobile } = useUIStore();

  // 每次打开面板，都以实际生效的配置为准同步草稿；
  // 切换对话不会改变配置，关闭再打开同样回到生效的那一份
  useEffect(() => {
    if (configPanelVisible) {
      syncDraft();
    }
  }, [configPanelVisible, syncDraft]);

  const handleClose = () => {
    setConfigPanelVisible(false);
  };

  const handleSave = () => {
    const result = saveDraft();
    if (result.success) {
      message.success('配置已保存');
      handleClose();
    } else {
      // 不允许保存：列出具体原因
      const reasons = ERROR_ORDER.flatMap((section) => {
        const sectionErrors =
          section === 'apiKey'
            ? [errors.apiKey]
            : section === 'model'
              ? [errors.model]
              : [errors.temperature, errors.maxTokens];
        return sectionErrors.filter((e): e is string => Boolean(e));
      });

      message.error({
        content: reasons.length > 0 ? `请检查配置项：${reasons.join('；')}` : '请检查配置项',
        duration: 5,
      });
    }
  };

  const handleReset = () => {
    resetConfig();
    message.info('已恢复默认配置');
  };

  const isDirty = (section: ConfigSection) => !isSectionEqual(section, draft, config);
  const hasSectionError = (section: ConfigSection) => {
    if (section === 'apiKey') return Boolean(errors.apiKey);
    if (section === 'model') return Boolean(errors.model);
    return Boolean(errors.temperature || errors.maxTokens);
  };

  return (
    <Drawer
      title="设置"
      placement="right"
      width={isMobile ? '100%' : 400}
      open={configPanelVisible}
      onClose={handleClose}
      className="config-panel"
      footer={
        <div className="config-panel-footer">
          <Button onClick={handleReset} icon={<ReloadOutlined />}>
            重置
          </Button>
          <Button type="primary" onClick={handleSave} icon={<SaveOutlined />}>
            保存
          </Button>
        </div>
      }
    >
      <div className="config-panel-content">
        <section className="config-section">
          <SectionHeader
            section="apiKey"
            dirty={isDirty('apiKey')}
            invalid={hasSectionError('apiKey')}
            onReset={resetDraftSection}
          />
          <APIKeyInput
            value={draft.apiKey}
            onChange={(value) => updateDraft({ apiKey: value })}
            error={errors.apiKey}
          />
        </section>

        <Divider />

        <section className="config-section">
          <SectionHeader
            section="model"
            dirty={isDirty('model')}
            invalid={hasSectionError('model')}
            onReset={resetDraftSection}
          />
          <ModelSelector
            value={draft.model}
            onChange={(value) => updateDraft({ model: value })}
            error={errors.model}
          />
        </section>

        <Divider />

        <section className="config-section">
          <SectionHeader
            section="parameters"
            dirty={isDirty('parameters')}
            invalid={hasSectionError('parameters')}
            onReset={resetDraftSection}
          />
          <ParameterSlider
            temperature={draft.temperature}
            maxTokens={draft.maxTokens}
            onTemperatureChange={(value) => updateDraft({ temperature: value })}
            onMaxTokensChange={(value) => updateDraft({ maxTokens: value })}
            temperatureError={errors.temperature}
            maxTokensError={errors.maxTokens}
          />
        </section>
      </div>
    </Drawer>
  );
}
