
import { Select, Typography } from 'antd';
import { AVAILABLE_MODELS } from '../../types';
import './ModelSelector.css';

const { Text } = Typography;

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * 模型选择器组件
 */
export function ModelSelector({ value, onChange, error }: ModelSelectorProps) {
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === value);

  return (
    <div className="model-selector">
      <label className="input-label">模型</label>
      <Select
        value={value}
        onChange={onChange}
        size="large"
        style={{ width: '100%' }}
        status={error ? 'error' : undefined}
        optionLabelProp="label"
        options={AVAILABLE_MODELS.map((model) => ({
          value: model.id,
          label: model.name,
          desc: model.description,
        }))}
        optionRender={(option) => (
          <div className="model-option">
            <span className="model-name">{option.label}</span>
            {option.data.desc && (
              <span className="model-desc">{option.data.desc}</span>
            )}
          </div>
        )}
      />
      {error ? (
        <Text type="danger" className="input-error">
          {error}
        </Text>
      ) : (
        selectedModel?.description && (
          <Text type="secondary" className="model-description">
            {selectedModel.description}
            {selectedModel.maxContext && ` · 最大上下文: ${selectedModel.maxContext.toLocaleString()} tokens`}
          </Text>
        )
      )}
    </div>
  );
}
