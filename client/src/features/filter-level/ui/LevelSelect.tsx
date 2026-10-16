import React from 'react';
import { Select } from 'antd';
import { CEFR_LEVELS } from '@/shared/config/constants';
import styles from './LevelSelect.module.scss';

interface LevelSelectProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({ value, onChange, className }) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      className={`${styles.select} ${className || ''}`.trim()}
      options={CEFR_LEVELS.map(l => ({
        value: l.value,
        label: l.value,
      }))}
    />
  );
};
