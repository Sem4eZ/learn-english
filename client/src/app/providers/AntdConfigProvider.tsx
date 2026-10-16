import React from 'react';
import { ConfigProvider, theme } from 'antd';
import ruRU from 'antd/locale/ru_RU';

interface AntdConfigProviderProps {
  isDark: boolean;
  children: React.ReactNode;
}

export const AntdConfigProvider: React.FC<AntdConfigProviderProps> = ({ isDark, children }) => {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorInfo: '#06b6d4',
          colorSuccess: '#10b981',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          borderRadius: 12,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};
