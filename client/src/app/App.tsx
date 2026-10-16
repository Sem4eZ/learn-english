import React, { useState, useEffect } from 'react';
import { Layout, message } from 'antd';
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
import '@/shared/styles/global.scss';
import styles from './App.module.scss';

const { Content, Footer } = Layout;

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('fluentiq_theme') !== 'light' && localStorage.getItem('lexiflow_theme') !== 'light';
  });

  // Default homepage is now the interactive Trainers Hub ('arcade')
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

  // Fetch sections
  const loadSections = async () => {
    try {
      const data = await sectionApi.getSections();
      setSections(data);
    } catch (err: any) {
      console.error('Failed to load sections:', err);
    }
  };

  // Fetch current user auth info
  const loadUser = async () => {
    try {
      const res: any = await apiClient.get('/auth/me');
      if (res.success && res.user) {
        setCurrentUser(res.user);
      }
    } catch (err) {
      console.error('Failed to load user info:', err);
    }
  };

  // Fetch user stats
  const loadStats = async () => {
    try {
      const data = await userApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load user stats:', err);
    }
  };

  useEffect(() => {
    loadSections();
    loadUser();
    loadStats();
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
              onRefreshStats={loadStats}
            />
          )}

          {activeTab === 'dictionary' && (
            <DictionaryPage />
          )}

          {activeTab === 'stats' && (
            <DashboardPage stats={stats} />
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
