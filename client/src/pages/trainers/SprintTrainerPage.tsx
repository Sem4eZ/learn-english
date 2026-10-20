import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { SpeedSprint } from '@/widgets/speed-sprint';
import { TrainerLayout } from '@/widgets/trainer-layout';
import { useTrainerWords } from '@/features/trainer-session';
import { AuthUser } from '@/features/auth';

export interface SprintTrainerPageProps {
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
  onRefreshStats?: () => void;
}

export const SprintTrainerPage: React.FC<SprintTrainerPageProps> = ({
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
    category,
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
      title="Скоростной Спринт (60с)"
      icon="⚡"
      level={level}
      category={category}
      isCramMode={isCramMode}
      wordsCount={words.length}
      loading={loading}
      onBack={() => navigate('/trainers')}
      onGenerate={() => handleNeedMoreWords(35)}
    >
      <SpeedSprint
        words={words}
        onComplete={(_score, _combo, xp) => handleGameComplete(xp)}
        onClose={() => navigate('/trainers')}
        onNeedMore={() => handleNeedMoreWords(35)}
      />
    </TrainerLayout>
  );
};
