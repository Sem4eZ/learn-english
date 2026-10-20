import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { WordBuilder } from '@/widgets/word-builder';
import { TrainerLayout } from '@/widgets/trainer-layout';
import { useTrainerWords } from '@/features/trainer-session';
import { AuthUser } from '@/features/auth';

export interface BuilderTrainerPageProps {
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
  onRefreshStats?: () => void;
}

export const BuilderTrainerPage: React.FC<BuilderTrainerPageProps> = ({
  currentUser,
  onRequireAuth,
  onRefreshStats,
}) => {
  const navigate = useNavigate();
  const {
    words,
    loading,
    isCramMode,
    level,
    handleNeedMoreWords,
    handleGameComplete,
  } = useTrainerWords({ onRefreshStats });

  React.useEffect(() => {
    if (!currentUser) {
      message.warning('Для выполнения тренировок и сохранения прогресса войдите или зарегистрируйтесь');
      onRequireAuth?.();
    }
  }, [currentUser, onRequireAuth]);

  return (
    <TrainerLayout
      title="Конструктор слов (Спеллинг)"
      icon="🧩"
      level={level}
      isCramMode={isCramMode}
      wordsCount={words.length}
      loading={loading}
      onBack={() => navigate('/trainers')}
      onGenerate={() => handleNeedMoreWords(35)}
    >
      <WordBuilder
        words={words}
        onComplete={(_score, _total, xp) => handleGameComplete(xp)}
        onClose={() => navigate('/trainers')}
        onNeedMore={() => handleNeedMoreWords(35)}
      />
    </TrainerLayout>
  );
};
