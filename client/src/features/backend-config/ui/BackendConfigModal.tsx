import React, { useState } from 'react';
import { Modal, Input, Button, Typography, Space, Alert, Tag, message } from 'antd';
import { ApiOutlined, CheckCircleFilled, CloudServerOutlined, ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/shared/api/client';

const { Text, Paragraph } = Typography;

interface BackendConfigModalProps {
  open: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  open,
  onClose,
  onConnected,
}) => {
  const [url, setUrl] = useState<string>(() => localStorage.getItem('fluentiq_api_url') || '');
  const [testing, setTesting] = useState(false);
  const isOffline = apiClient.isOfflineMode();

  const handleTestAndSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      apiClient.setApiUrl('');
      message.info('Включен встроенный демонстрационный режим');
      onConnected?.();
      onClose();
      return;
    }

    setTesting(true);
    try {
      const cleanUrl = trimmed.replace(/\/$/, '') + (trimmed.endsWith('/api') ? '' : '/api');
      const testRes = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(5000) });
      if (testRes.ok) {
        apiClient.setApiUrl(trimmed);
        message.success('Успешное подключение к бэкенд-серверу!');
        onConnected?.();
        onClose();
        window.location.reload();
      } else {
        throw new Error(`Статус ${testRes.status}`);
      }
    } catch (err: any) {
      message.error(`Не удалось подключиться: ${err.message || 'Сервер недоступен'}. Проверьте адрес и CORS.`);
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    apiClient.setApiUrl('');
    setUrl('');
    message.info('Настройки сброшены на встроенный режим');
    onConnected?.();
    onClose();
    window.location.reload();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <CloudServerOutlined style={{ color: '#1677ff' }} />
          <span>Подключение к бэкенду</span>
        </Space>
      }
      footer={[
        <Button key="reset" onClick={handleReset}>
          Сбросить на демо
        </Button>,
        <Button key="save" type="primary" loading={testing} onClick={handleTestAndSave}>
          Сохранить и подключить
        </Button>,
      ]}
    >
      <div style={{ padding: '8px 0' }}>
        <Paragraph type="secondary">
          GitHub Pages предоставляет только статический хостинг. Для генерации заданий через <b>Gemini AI</b> и работы с базой данных укажите адрес вашего бэкенд-сервера (например, на Render или Railway):
        </Paragraph>

        <Alert
          type={isOffline ? 'warning' : 'success'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            isOffline ? (
              <span>
                Текущий статус: <Tag color="orange">Офлайн / Демо-режим</Tag>
              </span>
            ) : (
              <span>
                Подключен бэкенд: <Tag color="green">{apiClient.getApiUrl()}</Tag>
              </span>
            )
          }
          description={
            isOffline
              ? 'Используются встроенные слова, локальный расчет интервалов SRS и сохранение в браузере.'
              : 'Все запросы отправляются на внешний бэкенд-сервер с базой данных SQLite.'
          }
        />

        <div style={{ marginBottom: 8 }}>
          <Text strong>Адрес API сервера:</Text>
        </div>
        <Input
          placeholder="https://learn-english-api.onrender.com или http://localhost:3001"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          prefix={<ApiOutlined />}
          size="large"
          allowClear
        />
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'gray' }}>
          💡 Для локального тестирования можно указать <code>http://localhost:3001</code>
        </div>
      </div>
    </Modal>
  );
};
