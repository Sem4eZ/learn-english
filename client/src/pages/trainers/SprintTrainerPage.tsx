import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { SpeedSprint } from '@/widgets/speed-sprint/ui/SpeedSprint';
import { TrainerLayout } from '@/widgets/trainer-layout/ui/TrainerLayout';
import { useTrainerWords } from '@/shared/hooks/useTrainerWords';
import { AuthUser } from '@/features/auth/ui/AuthModal';

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
