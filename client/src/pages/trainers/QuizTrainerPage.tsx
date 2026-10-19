import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { VocabQuiz } from '@/widgets/vocab-quiz/ui/VocabQuiz';
import { TrainerLayout } from '@/widgets/trainer-layout/ui/TrainerLayout';
import { useTrainerWords } from '@/shared/hooks/useTrainerWords';
import { AuthUser } from '@/features/auth/ui/AuthModal';

export interface QuizTrainerPageProps {
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
  onRefreshStats?: () => void;
}

export const QuizTrainerPage: React.FC<QuizTrainerPageProps> = ({
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
      title="Квиз: выбор 1 из 4"
      icon="🎯"
      level={level}
      isCramMode={isCramMode}
      wordsCount={words.length}
      loading={loading}
      onBack={() => navigate('/trainers')}
      onGenerate={() => handleNeedMoreWords(35)}
    >
      <VocabQuiz
        words={words}
        onComplete={(_score, _total, xp) => handleGameComplete(xp)}
        onClose={() => navigate('/trainers')}
        onNeedMore={() => handleNeedMoreWords(35)}
      />
    </TrainerLayout>
  );
};
