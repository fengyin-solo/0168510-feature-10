
import { Slider, InputNumber, Typography, Row, Col } from 'antd';
import './ParameterSlider.css';

const { Text } = Typography;

interface ParameterSliderProps {
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (value: number) => void;
  onMaxTokensChange: (value: number) => void;
  temperatureError?: string;
  maxTokensError?: string;
}

/**
 * 参数滑块组件
 */
export function ParameterSlider({
  temperature,
  maxTokens,
  onTemperatureChange,
  onMaxTokensChange,
  temperatureError,
  maxTokensError,
}: ParameterSliderProps) {
  return (
    <div className="parameter-slider">
      {/* Temperature */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Temperature</label>
          <Text type="secondary" className="parameter-value">
            {Number.isFinite(temperature) ? temperature.toFixed(1) : '-'}
          </Text>
        </div>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={typeof temperature === 'number' && Number.isFinite(temperature) ? temperature : 0}
          onChange={onTemperatureChange}
          marks={{
            0: '精确',
            1: '平衡',
            2: '创意',
          }}
        />
        {temperatureError ? (
          <Text type="danger" className="parameter-error">
            {temperatureError}
          </Text>
        ) : (
          <Text type="secondary" className="parameter-hint">
            较低的值使输出更确定，较高的值使输出更随机
          </Text>
        )}
      </div>

      {/* Max Tokens */}
      <div className="parameter-item">
        <div className="parameter-header">
          <label className="input-label">Max Tokens</label>
        </div>
        <Row gutter={16}>
          <Col span={16}>
            <Slider
              min={100}
              max={8192}
              step={100}
              value={typeof maxTokens === 'number' && Number.isFinite(maxTokens) ? maxTokens : 100}
              onChange={onMaxTokensChange}
            />
          </Col>
          <Col span={8}>
            <InputNumber
              min={1}
              max={8192}
              step={100}
              status={maxTokensError ? 'error' : undefined}
              value={maxTokens}
              onChange={(value) => {
                if (value !== null) {
                  onMaxTokensChange(value);
                }
              }}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
        {maxTokensError ? (
          <Text type="danger" className="parameter-error">
            {maxTokensError}
          </Text>
        ) : (
          <Text type="secondary" className="parameter-hint">
            控制回复的最大长度
          </Text>
        )}
      </div>
    </div>
  );
}
