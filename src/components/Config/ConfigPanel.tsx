
import { useEffect } from 'react';
import { Drawer, Button, Divider, Tag, message } from 'antd';
import { SaveOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import { APIKeyInput } from './APIKeyInput';
import { ModelSelector } from './ModelSelector';
import { ParameterSlider } from './ParameterSlider';
import { useConfigStore } from '../../stores/configStore';
import { useUIStore } from '../../stores/uiStore';
import type { ConfigSection } from '../../types';
import './ConfigPanel.css';

/** 各区块的展示名称 */
const SECTION_TITLES: Record<ConfigSection, string> = {
  api: 'API 配置',
  model: '模型设置',
  parameters: '参数调整',
};

/**
 * 配置面板组件
 *
 * 生效口径：面板里的修改先落在草稿上，点击「保存」且校验通过后才真正生效；
 * 每个区块会标明当前改动是否已保存；「重置为默认」只重置对应区块，
 * 底部「重置」为整块重置（立即生效）。
 */
export function ConfigPanel() {
  const {
    draft,
    errors,
    updateDraft,
    saveDraft,
    discardDraft,
    resetConfig,
    resetSection,
    isSectionDirty,
  } = useConfigStore();

  const { configPanelVisible, setConfigPanelVisible, isMobile } = useUIStore();

  // 打开面板时，让面板里的取值对齐实际生效的配置
  useEffect(() => {
    if (configPanelVisible) {
      discardDraft();
    }
  }, [configPanelVisible, discardDraft]);

  const handleClose = () => {
    // 未保存的修改不带出面板
    discardDraft();
    setConfigPanelVisible(false);
  };

  const handleSave = () => {
    if (saveDraft()) {
      message.success('配置已保存');
      setConfigPanelVisible(false);
    } else {
      // 不允许保存，并写明不通过的原因
      const reasons = Object.values(useConfigStore.getState().errors).filter(Boolean);
      message.error(
        reasons.length > 0 ? `无法保存：${reasons.join('；')}` : '保存配置失败，请稍后重试'
      );
    }
  };

  const handleReset = () => {
    resetConfig();
    message.info('已恢复默认配置');
  };

  const handleResetSection = (section: ConfigSection) => {
    resetSection(section);
    message.info(`已将「${SECTION_TITLES[section]}」恢复为默认值`);
  };

  const renderSectionHeader = (section: ConfigSection) => {
    const dirty = isSectionDirty(section);
    return (
      <div className="section-header">
        <h3 className="section-title">{SECTION_TITLES[section]}</h3>
        <span className="section-actions">
          <Tag className="section-status" color={dirty ? 'warning' : 'success'}>
            {dirty ? '未保存' : '已保存'}
          </Tag>
          <Button
            type="link"
            size="small"
            icon={<UndoOutlined />}
            onClick={() => handleResetSection(section)}
          >
            重置为默认
          </Button>
        </span>
      </div>
    );
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
          {renderSectionHeader('api')}
          <APIKeyInput
            value={draft.apiKey}
            onChange={(value) => updateDraft({ apiKey: value })}
            error={errors.apiKey}
          />
        </section>

        <Divider />

        <section className="config-section">
          {renderSectionHeader('model')}
          <ModelSelector
            value={draft.model}
            onChange={(value) => updateDraft({ model: value })}
            error={errors.model}
          />
        </section>

        <Divider />

        <section className="config-section">
          {renderSectionHeader('parameters')}
          <ParameterSlider
            temperature={draft.temperature}
            maxTokens={draft.maxTokens}
            temperatureError={errors.temperature}
            maxTokensError={errors.maxTokens}
            onTemperatureChange={(value) => updateDraft({ temperature: value })}
            onMaxTokensChange={(value) => updateDraft({ maxTokens: value })}
          />
        </section>
      </div>
    </Drawer>
  );
}
