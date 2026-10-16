import React from 'react';
import { Layout, Space, Button, Tag, Dropdown, MenuProps, Avatar } from 'antd';
import { 
  FireFilled, 
  ThunderboltFilled, 
  TrophyOutlined, 
  BulbOutlined, 
  HistoryOutlined, 
  BookOutlined,
  UserOutlined,
  LogoutOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { UserStats } from '@/entities/user/model/types';
import { AuthUser } from '@/features/auth/ui/AuthModal';
import styles from './AppHeader.module.scss';

const { Header } = Layout;

interface AppHeaderProps {
  stats: UserStats | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  currentUser?: AuthUser | null;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  stats,
  activeTab,
  onTabChange,
  isDark,
  onToggleTheme,
  currentUser,
  onOpenAuth,
  onLogout
}) => {
  const xp = stats?.xp ?? currentUser?.xp ?? 0;
  const streak = stats?.streak ?? currentUser?.streak ?? 1;
  const level = stats?.level ?? currentUser?.level ?? 1;

  const isGuest = !currentUser || currentUser.isGuest;

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div className={styles.dropdownUserInfo}>
          <div className={styles.dropdownUserName}>{currentUser?.username || 'Гость'}</div>
          <div className={styles.dropdownUserMeta}>Уровень {level} • {xp} XP</div>
        </div>
      )
    },
    {
      type: 'divider'
    },
    {
      key: 'switch',
      icon: <SwapOutlined />,
      label: 'Сменить аккаунт',
      onClick: onOpenAuth
    },
    ...(!isGuest ? [{
      key: 'logout',
      icon: <LogoutOutlined />,
      danger: true,
      label: 'Выйти из аккаунта',
      onClick: onLogout
    }] : [])
  ];

  return (
    <Header className={`${styles.header} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.headerInner}>
        {/* Brand */}
        <div 
          className={styles.brand}
          onClick={() => onTabChange('arcade')}
        >
          <div className={styles.brandIcon}>
            FQ
          </div>
          <div className={styles.brandText}>
            <div className={`${styles.brandTitle} ${isDark ? styles.dark : styles.light}`}>
              Fluentiq
            </div>
            <div className={styles.brandSubtitle}>
              English Mastery Platform
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <Space size="middle" className="header-nav">
          <Button
            type={activeTab === 'arcade' ? 'primary' : 'text'}
            icon={<ThunderboltFilled />}
            onClick={() => onTabChange('arcade')}
          >
            🎮 Тренажеры
          </Button>
          <Button
            type={activeTab === 'dictionary' ? 'primary' : 'text'}
            icon={<BookOutlined />}
            onClick={() => onTabChange('dictionary')}
          >
            Словарь
          </Button>
          <Button
            type={activeTab === 'stats' ? 'primary' : 'text'}
            icon={<TrophyOutlined />}
            onClick={() => onTabChange('stats')}
          >
            Дашборд
          </Button>
          <Button
            type={activeTab === 'history' ? 'primary' : 'text'}
            icon={<HistoryOutlined />}
            onClick={() => onTabChange('history')}
          >
            История и ошибки
          </Button>
        </Space>

        {/* Stats & User Widgets */}
        <Space size="small">
          <Tag color="warning" className={styles.statTag}>
            <FireFilled className={styles.statIconAmber} />
            {streak} дн.
          </Tag>

          <Tag color="cyan" className={styles.statTag}>
            <ThunderboltFilled className={styles.statIconCyan} />
            {xp} XP
          </Tag>

          <Tag color="purple" className={styles.statTag}>
            Lvl {level}
          </Tag>

          {/* User Auth Profile */}
          {isGuest ? (
            <Button
              type="primary"
              ghost
              size="middle"
              icon={<UserOutlined />}
              onClick={onOpenAuth}
              className={styles.userBtn}
            >
              Войти
            </Button>
          ) : (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <Button type="text" className={`${styles.userBtn} ${styles.userProfileBtn}`}>
                <Avatar size="small" className={styles.userAvatar}>
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </Avatar>
                <span className={styles.userName}>{currentUser?.username}</span>
              </Button>
            </Dropdown>
          )}

          <Button
            type="text"
            shape="circle"
            icon={<BulbOutlined />}
            onClick={onToggleTheme}
            title="Сменить тему"
          />
        </Space>
      </div>
    </Header>
  );
};
