import React, { useState } from 'react';
import { Layout, Space, Button, Tag, Dropdown, MenuProps, Avatar, Drawer, Divider } from 'antd';
import { 
  FireFilled, 
  ThunderboltFilled, 
  TrophyOutlined, 
  BulbOutlined, 
  HistoryOutlined, 
  BookOutlined,
  UserOutlined,
  LogoutOutlined,
  SwapOutlined,
  MenuOutlined,
  RightOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserStats } from '@/entities/user';
import { AuthUser } from '@/features/auth';
import styles from './AppHeader.module.scss';

const { Header } = Layout;

interface AppHeaderProps {
  stats: UserStats | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
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
  onLogout,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const currentTab = React.useMemo(() => {
    if (activeTab) return activeTab;
    const path = location.pathname;
    if (path.startsWith('/dictionary')) return 'dictionary';
    if (path.startsWith('/stats') || path.startsWith('/dashboard')) return 'stats';
    if (path.startsWith('/history')) return 'history';
    return 'arcade';
  }, [activeTab, location.pathname]);

  const xp = stats?.xp ?? currentUser?.xp ?? 0;
  const streak = stats?.streak ?? currentUser?.streak ?? 1;
  const level = stats?.level ?? currentUser?.level ?? 1;

  const isGuest = !currentUser || currentUser.isGuest;

  const handleTabClick = (tab: string) => {
    onTabChange?.(tab);
    if (tab === 'arcade') navigate('/trainers');
    else if (tab === 'dictionary') navigate('/dictionary');
    else if (tab === 'stats') navigate('/stats');
    else if (tab === 'history') navigate('/history');
    setDrawerOpen(false);
  };

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
    <>
      <Header className={`${styles.header} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.headerInner}>
          {/* Brand */}
          <div 
            className={styles.brand}
            onClick={() => handleTabClick('arcade')}
            role="button"
            tabIndex={0}
          >
            <div className={styles.brandIcon}>
              FQ
            </div>
            <div className={styles.brandText}>
              <div className={`${styles.brandTitle} ${isDark ? styles.dark : styles.light}`}>
                Fluentiq
              </div>
              <div className={styles.brandSubtitle}>
                English Mastery
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links (Hidden on tablet/mobile < 960px) */}
          <div className={styles.desktopNav}>
            <Space size="middle">
              <Button
                type={currentTab === 'arcade' ? 'primary' : 'text'}
                icon={<ThunderboltFilled />}
                onClick={() => handleTabClick('arcade')}
              >
                🎮 Тренажеры
              </Button>
              <Button
                type={currentTab === 'dictionary' ? 'primary' : 'text'}
                icon={<BookOutlined />}
                onClick={() => handleTabClick('dictionary')}
              >
                Словарь
              </Button>
              <Button
                type={currentTab === 'stats' ? 'primary' : 'text'}
                icon={<TrophyOutlined />}
                onClick={() => handleTabClick('stats')}
              >
                Дашборд
              </Button>
              <Button
                type={currentTab === 'history' ? 'primary' : 'text'}
                icon={<HistoryOutlined />}
                onClick={() => handleTabClick('history')}
              >
                История
              </Button>
            </Space>
          </div>

          {/* Desktop Stats & User Profile (Hidden on mobile < 768px) */}
          <div className={styles.desktopControls}>
            <Space size="small">
              <Tag
                color="warning"
                className={`${styles.statTag} ${styles.interactiveStat}`}
                onClick={() => handleTabClick('stats')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
                aria-label={`Серия: ${streak} дней`}
              >
                <FireFilled className={styles.statIconAmber} />
                {streak} дн.
              </Tag>

              <Tag
                color="cyan"
                className={`${styles.statTag} ${styles.interactiveStat}`}
                onClick={() => handleTabClick('stats')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
                aria-label={`Опыт: ${xp} XP`}
              >
                <ThunderboltFilled className={styles.statIconCyan} />
                {xp} XP
              </Tag>

              <Tag
                color="purple"
                className={`${styles.statTag} ${styles.interactiveStat}`}
                onClick={() => handleTabClick('stats')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
                aria-label={`Уровень: ${level}`}
              >
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

          {/* Mobile Quick Controls (< 768px) */}
          <div className={styles.mobileControls}>
            {/* Quick XP Tag on mobile */}
            <Tag
              color="cyan"
              className={`${styles.mobileStatPill} ${styles.interactiveStat}`}
              onClick={() => handleTabClick('stats')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
              aria-label={`Опыт: ${xp} XP`}
            >
              ⚡ {xp}
            </Tag>

            {/* Quick Streak Tag on mobile */}
            <Tag
              color="warning"
              className={`${styles.mobileStatPill} ${styles.interactiveStat}`}
              onClick={() => handleTabClick('stats')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
              aria-label={`Серия: ${streak} дней`}
            >
              🔥 {streak}
            </Tag>

            {/* Quick Level Tag on mobile */}
            <Tag
              color="purple"
              className={`${styles.mobileStatPill} ${styles.interactiveStat}`}
              onClick={() => handleTabClick('stats')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
              aria-label={`Уровень: ${level}`}
            >
              Ур. {level}
            </Tag>

            {/* Theme Toggle */}
            <Button
              type="text"
              shape="circle"
              size="middle"
              icon={<BulbOutlined />}
              onClick={onToggleTheme}
              title="Тема"
            />

            {/* Mobile Hamburger Drawer Menu */}
            <Button
              type="text"
              icon={<MenuOutlined />}
              size="middle"
              onClick={() => setDrawerOpen(true)}
              className={styles.hamburgerBtn}
              aria-label="Меню приложения"
            />
          </div>
        </div>
      </Header>

      {/* Mobile Drawer */}
      <Drawer
        title={
          <div className={styles.drawerTitle}>
            <div className={styles.brandIconSmall}>FQ</div>
            <span>Fluentiq Меню</span>
          </div>
        }
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{ 
          wrapper: { maxWidth: '85vw', width: 320 },
          body: { padding: '16px' } 
        }}
      >
        {/* User Profile Card */}
        <div className={styles.drawerUserCard}>
          <div className={styles.drawerUserHeader}>
            <Avatar size={48} className={styles.userAvatarLarge}>
              {isGuest ? '?' : currentUser?.username?.charAt(0).toUpperCase()}
            </Avatar>
            <div className={styles.drawerUserInfo}>
              <div className={styles.drawerUsername}>
                {isGuest ? 'Гостевой режим' : currentUser?.username}
              </div>
              <div 
                className={`${styles.drawerUserStats} ${styles.interactiveDrawerStats}`}
                onClick={() => handleTabClick('stats')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTabClick('stats'); } }}
              >
                Уровень {level} • {xp} XP • {streak} дн.🔥
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {isGuest ? (
              <Button
                type="primary"
                block
                icon={<UserOutlined />}
                onClick={() => {
                  setDrawerOpen(false);
                  onOpenAuth?.();
                }}
              >
                Войти / Регистрация
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <Button
                  block
                  icon={<SwapOutlined />}
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenAuth?.();
                  }}
                >
                  Сменить аккаунт
                </Button>
                <Button
                  block
                  danger
                  icon={<LogoutOutlined />}
                  onClick={() => {
                    setDrawerOpen(false);
                    onLogout?.();
                  }}
                >
                  Выйти
                </Button>
              </div>
            )}
          </div>
        </div>

        <Divider style={{ margin: '14px 0' }} />

        {/* Navigation list in Drawer */}
        <div className={styles.drawerNavList}>
          <div className={styles.drawerNavTitle}>Разделы приложения</div>
          <Button
            type={currentTab === 'arcade' ? 'primary' : 'text'}
            block
            size="large"
            icon={<ThunderboltFilled />}
            className={styles.drawerNavBtn}
            onClick={() => handleTabClick('arcade')}
          >
            🎮 Тренажеры
            <RightOutlined className={styles.drawerArrow} />
          </Button>
          <Button
            type={currentTab === 'dictionary' ? 'primary' : 'text'}
            block
            size="large"
            icon={<BookOutlined />}
            className={styles.drawerNavBtn}
            onClick={() => handleTabClick('dictionary')}
          >
            📖 Словарь
            <RightOutlined className={styles.drawerArrow} />
          </Button>
          <Button
            type={currentTab === 'stats' ? 'primary' : 'text'}
            block
            size="large"
            icon={<TrophyOutlined />}
            className={styles.drawerNavBtn}
            onClick={() => handleTabClick('stats')}
          >
            🏆 Дашборд прогресса
            <RightOutlined className={styles.drawerArrow} />
          </Button>
          <Button
            type={currentTab === 'history' ? 'primary' : 'text'}
            block
            size="large"
            icon={<HistoryOutlined />}
            className={styles.drawerNavBtn}
            onClick={() => handleTabClick('history')}
          >
            📜 История и ошибки
            <RightOutlined className={styles.drawerArrow} />
          </Button>
        </div>
      </Drawer>

      {/* Mobile Bottom Navigation Bar (< 768px) */}
      <nav className={styles.bottomNav} aria-label="Мобильная навигация">
        <button
          type="button"
          className={`${styles.bottomNavItem} ${currentTab === 'arcade' ? styles.active : ''}`}
          onClick={() => handleTabClick('arcade')}
          aria-label="Тренажеры"
        >
          <ThunderboltFilled className={styles.bottomNavIcon} />
          <span className={styles.bottomNavLabel}>Тренажеры</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${currentTab === 'dictionary' ? styles.active : ''}`}
          onClick={() => handleTabClick('dictionary')}
          aria-label="Словарь"
        >
          <BookOutlined className={styles.bottomNavIcon} />
          <span className={styles.bottomNavLabel}>Словарь</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${currentTab === 'stats' ? styles.active : ''}`}
          onClick={() => handleTabClick('stats')}
          aria-label="Дашборд"
        >
          <TrophyOutlined className={styles.bottomNavIcon} />
          <span className={styles.bottomNavLabel}>Дашборд</span>
        </button>

        <button
          type="button"
          className={`${styles.bottomNavItem} ${currentTab === 'history' ? styles.active : ''}`}
          onClick={() => handleTabClick('history')}
          aria-label="История"
        >
          <HistoryOutlined className={styles.bottomNavIcon} />
          <span className={styles.bottomNavLabel}>История</span>
        </button>
      </nav>
    </>
  );
};
