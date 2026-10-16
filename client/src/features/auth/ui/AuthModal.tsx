import React, { useState } from 'react';
import { Modal, Tabs, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useLoginMutation, useRegisterMutation, authSession } from '../api/authApi';
import styles from './AuthModal.module.scss';

const { Title, Text } = Typography;

export interface AuthUser {
  id: string;
  username: string;
  xp: number;
  streak: number;
  level: number;
  isGuest?: boolean;
}

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      const res = await loginMutation({
        username: values.username.trim(),
        password: values.password
      }).unwrap();

      if (res.success && res.token && res.user) {
        authSession.setAuth(res.token, res.user.id, res.user, res.refreshToken);
        message.success(`С возвращением, ${res.user.username}!`);
        onSuccess(res.user);
        onClose();
        loginForm.resetFields();
      } else {
        message.error(res.error || 'Ошибка входа');
      }
    } catch (err: any) {
      message.error(err.data?.error || err.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      const res = await registerMutation({
        username: values.username.trim(),
        password: values.password
      }).unwrap();

      if (res.success && res.token && res.user) {
        authSession.setAuth(res.token, res.user.id, res.user, res.refreshToken);
        message.success(`Добро пожаловать в Fluentiq, ${res.user.username}!`);
        onSuccess(res.user);
        onClose();
        registerForm.resetFields();
      } else {
        message.error(res.error || 'Ошибка регистрации');
      }
    } catch (err: any) {
      message.error(err.data?.error || err.message || 'Не удалось зарегистрироваться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width={420}
      style={{ maxWidth: '94vw', margin: '0 auto' }}
    >
      <div className={styles.modalHeader}>
        <div className={styles.modalIcon}>✨</div>
        <Title level={3} className={styles.modalTitle}>
          {activeTab === 'login' ? 'Вход в аккаунт' : 'Создание аккаунта'}
        </Title>
        <Text type="secondary" className={styles.modalSubtitle}>
          Сохраняйте личный прогресс, рейтинг и интервалы повторений
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as any)}
        centered
        items={[
          {
            key: 'login',
            label: 'Вход',
            children: (
              <Form
                form={loginForm}
                layout="vertical"
                onFinish={handleLogin}
                className={styles.formBox}
              >
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: 'Введите имя пользователя' }]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Имя пользователя или логин"
                    size="large"
                    autoFocus
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[{ required: true, message: 'Введите пароль' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Пароль"
                    size="large"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  className={styles.submitBtn}
                >
                  Войти
                </Button>
              </Form>
            )
          },
          {
            key: 'register',
            label: 'Регистрация',
            children: (
              <Form
                form={registerForm}
                layout="vertical"
                onFinish={handleRegister}
                className={styles.formBox}
              >
                <Form.Item
                  name="username"
                  rules={[
                    { required: true, message: 'Придумайте имя пользователя' },
                    { min: 2, message: 'Минимум 2 символа' }
                  ]}
                >
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Логин (например, Alex_Pro)"
                    size="large"
                    autoFocus
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[
                    { required: true, message: 'Придумайте пароль' },
                    { min: 3, message: 'Минимум 3 символа' }
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder="Пароль (от 3 символов)"
                    size="large"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  className={styles.submitBtn}
                >
                  Создать аккаунт
                </Button>
              </Form>
            )
          }
        ]}
      />

      <div className={styles.note}>
        Без подтверждения почты и номера телефона
      </div>
    </Modal>
  );
};
