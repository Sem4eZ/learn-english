import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, message } from 'antd';
import { AntdConfigProvider } from './providers/AntdConfigProvider';
import { AppHeader } from '@/widgets/header/ui/AppHeader';
import { ArcadeHubPage } from '@/pages/ArcadeHubPage';
import { DictionaryPage } from '@/pages/DictionaryPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { QuizTrainerPage } from '@/pages/trainers/QuizTrainerPage';
import { SprintTrainerPage } from '@/pages/trainers/SprintTrainerPage';
import { BuilderTrainerPage } from '@/pages/trainers/BuilderTrainerPage';
import { CardsTrainerPage } from '@/pages/trainers/CardsTrainerPage';
import { AudioTrainerPage } from '@/pages/trainers/AudioTrainerPage';
import { GrammarTrainerPage } from '@/pages/trainers/GrammarTrainerPage';
import { GenerateBatchModal } from '@/features/generate-ai-batch/ui/GenerateBatchModal';
import { AuthModal, AuthUser } from '@/features/auth/ui/AuthModal';
import { Section } from '@/entities/section/model/types';
import { UserStats, INITIAL_USER_STATS } from '@/entities/user/model/types';
import { sectionApi } from '@/entities/section/api/sectionApi';
import { userApi } from '@/entities/user/api/userApi';
import { authSession } from '@/features/auth/api/authApi';
import { xpEventBus } from '@/shared/lib/xpEvents';
import '@/shared/styles/global.scss';
import { API_BASE_URL } from '@/shared/config';
import styles from './App.module.scss';

const { Content } = Layout;

export const App: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('fluentiq_theme') !== 'light' && localStorage.getItem('lexiflow_theme') !== 'light';
  });

  const [sections, setSections] = useState<Section[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authSession.getSavedUser());
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

  // Fetch current authenticated user with resilient refresh flow
  const loadUser = React.useCallback(async () => {
    const savedUser = authSession.getSavedUser();
    const token = authSession.getToken();
    const refreshToken = authSession.getRefreshToken();

    if (!token && !refreshToken && !savedUser) {
      setCurrentUser(null);
      setAuthModalOpen(true);
      return;
    }

    try {
      const res: any = await userApi.getMe();
      if (res && res.success && res.authenticated && res.user) {
        setCurrentUser(res.user);
        authSession.setAuth(
          authSession.getToken() || '',
          res.user.id,
          res.user,
          authSession.getRefreshToken() || undefined
        );
      } else if (res && res.authenticated === false) {
        if (refreshToken) {
          try {
            const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken })
            });
            const data = await refreshRes.json();
            if (data && data.success && data.token && data.user) {
              authSession.setAuth(data.token, data.user.id, data.user, data.refreshToken);
              setCurrentUser(data.user);
              return;
            }
          } catch (refreshErr) {
            console.warn('Failed to refresh auth token silently:', refreshErr);
          }
        }
        authSession.clearAuth();
        setCurrentUser(null);
        setAuthModalOpen(true);
      }
    } catch (err) {
      console.warn('Backend cold start / network delay, keeping saved user session:', err);
      if (savedUser) {
        setCurrentUser(savedUser);
      }
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
          const updatedUser = {
            ...prevUser,
            xp: newXp,
            streak,
            level
          };
          authSession.saveUser(updatedUser);
          return updatedUser;
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
  }, [loadSections, loadUser, loadStats]);

  const handleAuthSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    loadStats();
    loadSections();
  };

  const handleLogout = () => {
    authSession.clearAuth();
    setCurrentUser(null);
    setStats(INITIAL_USER_STATS);
    message.info('Вы вышли из аккаунта');
    setAuthModalOpen(true);
  };

  return (
    <AntdConfigProvider isDark={isDark}>
      <HashRouter>
        <Layout className={isDark ? styles.layoutDark : styles.layoutLight}>
          <AppHeader
            stats={stats}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            currentUser={currentUser}
            onOpenAuth={() => setAuthModalOpen(true)}
            onLogout={handleLogout}
          />

          <Content className={styles.content}>
            <Routes>
              {/* Main Hub & Default Route */}
              <Route path="/" element={<Navigate to="/trainers" replace />} />
              <Route
                path="/trainers"
                element={
                  <ArcadeHubPage
                    sections={sections}
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats}
                  />
                }
              />

              {/* Dedicated Trainer Routes */}
              <Route
                path="/trainers/quiz"
                element={
                  <QuizTrainerPage
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats}
                  />
                }
              />
              <Route
                path="/trainers/sprint"
                element={
                  <SprintTrainerPage
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats}
                  />
                }
              />
              <Route
                path="/trainers/builder"
                element={
                  <BuilderTrainerPage
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats}
                  />
                }
              />
              <Route
                path="/trainers/cards"
                element={
                  <CardsTrainerPage
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats}
                  />
                }
              />
              <Route
                path="/trainers/audio"
                element={
                  <AudioTrainerPage
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats}
                  />
                }
              />
              <Route
                path="/trainers/grammar"
                element={
                  <GrammarTrainerPage
                    allSections={sections}
                    onRefreshStats={loadStats}
                  />
                }
              />
              <Route path="/grammar" element={<Navigate to="/trainers/grammar" replace />} />

              {/* App Section Routes */}
              <Route
                path="/dictionary"
                element={
                  <DictionaryPage 
                    currentUser={currentUser}
                    onRequireAuth={() => setAuthModalOpen(true)}
                    onRefreshStats={loadStats} 
                  />
                }
              />
              <Route
                path="/stats"
                element={
                  <DashboardPage stats={stats} onRefreshStats={loadStats} />
                }
              />
              <Route
                path="/dashboard"
                element={<Navigate to="/stats" replace />}
              />
              <Route
                path="/history"
                element={<HistoryPage />}
              />

              {/* 404 Fallback */}
              <Route path="*" element={<Navigate to="/trainers" replace />} />
            </Routes>
          </Content>

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
      </HashRouter>
    </AntdConfigProvider>
  );
};
