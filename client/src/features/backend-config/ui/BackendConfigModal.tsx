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

const RENDER_BACKEND_URL = 'https://learn-english-bfqg.onrender.com';
const LOCAL_BACKEND_URL = 'http://localhost:3001';

export const BackendConfigModal: React.FC<BackendConfigModalProps> = ({
  open,
  onClose,
  onConnected,
}) => {
  const [url, setUrl] = useState<string>(() => localStorage.getItem('fluentiq_api_url') || '');
  const [testing, setTesting] = useState(false);
  const isOffline = apiClient.isOfflineMode();

  const handleTestAndSave = async (overrideUrl?: string) => {
    const raw = overrideUrl !== undefined ? overrideUrl : url;
    const trimmed = raw.trim();
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
      const testRes = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(6000) });
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
      message.error(`Не удалось подключиться: ${err.message || 'Сервер недоступен'}. Проверьте адрес и работу Render сервиса.`);
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
      width={520}
      style={{ maxWidth: '94vw', margin: '0 auto' }}
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
        <Button key="save" type="primary" loading={testing} onClick={() => handleTestAndSave()}>
          Сохранить и подключить
        </Button>,
      ]}
    >
      <div style={{ padding: '8px 0' }}>
        <Paragraph type="secondary" style={{ fontSize: '0.9rem' }}>
          GitHub Pages предоставляет только статический хостинг. Для генерации заданий через <b>Gemini AI</b> и работы с базой данных укажите адрес вашего бэкенд-сервера:
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

        {/* 1-Tap Quick Presets for phones */}
        <div style={{ marginBottom: 14 }}>
          <Text strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
            Быстрый выбор адреса в 1 клик:
          </Text>
          <Space wrap size="small">
            <Button
              size="middle"
              icon={<CloudServerOutlined />}
              type={url === RENDER_BACKEND_URL ? 'primary' : 'default'}
              ghost={url === RENDER_BACKEND_URL}
              onClick={() => {
                setUrl(RENDER_BACKEND_URL);
                message.info('Выбран Render URL');
              }}
            >
              ⚡ Render (Облачный сервер)
            </Button>
            <Button
              size="middle"
              onClick={() => {
                setUrl(LOCAL_BACKEND_URL);
                message.info('Выбран Localhost URL');
              }}
              type={url === LOCAL_BACKEND_URL ? 'primary' : 'default'}
              ghost={url === LOCAL_BACKEND_URL}
            >
              💻 Localhost:3001
            </Button>
          </Space>
        </div>

        <div style={{ marginBottom: 8 }}>
          <Text strong>Адрес API сервера:</Text>
        </div>
        <Input
          placeholder="https://learn-english-bfqg.onrender.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          prefix={<ApiOutlined />}
          size="large"
          allowClear
        />
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'gray' }}>
          💡 Ваш сервер Render: <code>https://learn-english-bfqg.onrender.com</code>
        </div>
      </div>
    </Modal>
  );
};
