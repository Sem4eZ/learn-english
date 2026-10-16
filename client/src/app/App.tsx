import React, { useState, useEffect } from 'react';
import { Layout, message, Spin } from 'antd';
import { AntdConfigProvider } from './providers/AntdConfigProvider';
import { AppHeader } from '@/widgets/header/ui/AppHeader';
import { ArcadeHubPage } from '@/pages/ArcadeHubPage';
import { DictionaryPage } from '@/pages/DictionaryPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { GenerateBatchModal } from '@/features/generate-ai-batch/ui/GenerateBatchModal';
import { AuthModal, AuthUser } from '@/features/auth/ui/AuthModal';
import { Section } from '@/entities/section/model/types';
import { UserStats } from '@/entities/user/model/types';
import { sectionApi } from '@/entities/section/api/sectionApi';
import { userApi } from '@/entities/user/api/userApi';
import { apiClient } from '@/shared/api/client';
import { xpEventBus } from '@/shared/lib/xpEvents';
import '@/shared/styles/global.scss';
import styles from './App.module.scss';

const { Content, Footer } = Layout;

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('fluentiq_theme') !== 'light' && localStorage.getItem('lexiflow_theme') !== 'light';
  });

  // Default homepage is the interactive Trainers Hub ('arcade')
  const [activeTab, setActiveTab] = useState<string>('arcade');

  const [sections, setSections] = useState<Section[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  const [generateModalOpen, setGenerateModalOpen] = useState<boolean>(false);
  const [targetSectionForGen, setTargetSectionForGen] = useState<string>('grammar');

  // Toggle theme
  const handleToggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('fluentiq_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  useEffect(() => {
    const themeName = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', themeName);
    if (isDark) {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
  }, [isDark]);

  // Fetch sections with automatic in-memory caching
  const loadSections = React.useCallback(async () => {
    try {
      const data = await sectionApi.getSections();
      setSections(data);
    } catch (err: any) {
      console.error('Failed to load sections:', err);
    }
  }, []);

  // Fetch current authenticated user
  const loadUser = React.useCallback(async () => {
    try {
      const res: any = await apiClient.get('/auth/me');
      if (res && res.success && res.authenticated && res.user) {
        setCurrentUser(res.user);
      } else {
        setCurrentUser(null);
        setAuthModalOpen(true);
      }
    } catch (err) {
      setCurrentUser(null);
      setAuthModalOpen(true);
    }
  }, []);

  // Fetch user stats
  const loadStats = React.useCallback(async () => {
    try {
      const data = await userApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  }, []);

  useEffect(() => {
    loadSections();
    loadUser();
    loadStats();

    // Real-time XP & Stats listener: updates header immediately upon every single answer/card
    const unsubscribe = xpEventBus.subscribe((detail) => {
      setStats(prev => {
        const currentXp = prev?.xp ?? 0;
        const newXp = detail.totalXp ?? (currentXp + detail.xpReward);
        const streak = detail.streak ?? (prev?.streak ?? 1);

        const level = Math.floor(Math.sqrt(newXp / 50)) + 1;
        const currentBase = Math.pow(level - 1, 2) * 50;
        const nextBase = Math.pow(level, 2) * 50;
        const progressXP = newXp - currentBase;
        const neededXP = nextBase - currentBase;
        const levelPercent = Math.min(100, Math.round((progressXP / neededXP) * 100));

        setCurrentUser(prevUser => {
          if (!prevUser) return prevUser;
          return {
            ...prevUser,
            xp: newXp,
            streak,
            level
          };
        });

        return {
          ...prev,
          xp: newXp,
          streak,
          level,
          levelPercent,
          progressXP,
          neededXP,
          correctAnswered: (prev?.correctAnswered ?? 0) + 1,
          totalAnswered: (prev?.totalAnswered ?? 0) + 1,
          accuracy: prev?.totalAnswered
            ? Math.round(((prev.correctAnswered + 1) / (prev.totalAnswered + 1)) * 100)
            : 100,
          sectionBreakdown: prev?.sectionBreakdown || []
        } as UserStats;
      });
    });

    return unsubscribe;
  }, []);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    loadStats();
    loadSections();
  };

  const handleLogout = () => {
    apiClient.clearAuth();
    setCurrentUser(null);
    message.info('Вы вышли из аккаунта');
    loadUser();
    loadStats();
  };

  return (
    <AntdConfigProvider isDark={isDark}>
      <Layout className={isDark ? styles.layoutDark : styles.layoutLight}>
        <AppHeader
          stats={stats}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          currentUser={currentUser}
          onOpenAuth={() => setAuthModalOpen(true)}
          onLogout={handleLogout}
        />

        <Content className={styles.content}>
          {activeTab === 'arcade' && (
            <ArcadeHubPage
              sections={sections}
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
              onRefreshStats={loadStats}
            />
          )}

          {activeTab === 'dictionary' && (
            <DictionaryPage 
              currentUser={currentUser}
              onRequireAuth={() => setAuthModalOpen(true)}
              onRefreshStats={loadStats} 
            />
          )}

          {activeTab === 'stats' && (
            <DashboardPage stats={stats} onRefreshStats={loadStats} />
          )}

          {activeTab === 'history' && (
            <HistoryPage />
          )}
        </Content>

        <Footer className={styles.footer}>
          Fluentiq — Интерактивная платформа изучения английского языка © 2026.
        </Footer>

        {/* Global Modal for batch generation */}
        <GenerateBatchModal
          visible={generateModalOpen}
          sections={sections}
          initialSectionId={targetSectionForGen}
          onClose={() => setGenerateModalOpen(false)}
          onGenerated={() => {
            loadSections();
            loadStats();
          }}
        />

        {/* Auth Modal (Login / Register) */}
        <AuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      </Layout>
    </AntdConfigProvider>
  );
};
