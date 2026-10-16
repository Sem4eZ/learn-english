import React from 'react';
import { Select } from 'antd';
import { CEFR_LEVELS } from '@/shared/config/constants';

interface LevelSelectProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({ value, onChange, style }) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      style={{ width: 140, ...style }}
      options={CEFR_LEVELS.map(l => ({
        value: l.value,
        label: l.value,
      }))}
    />
  );
};
