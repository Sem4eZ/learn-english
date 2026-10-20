import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { FlashcardDeck } from '@/widgets/flashcard-deck';
import { TrainerLayout } from '@/widgets/trainer-layout';
import { useTrainerWords } from '@/features/trainer-session';
import { AuthUser } from '@/features/auth';

export interface CardsTrainerPageProps {
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
  onRefreshStats?: () => void;
}

export const CardsTrainerPage: React.FC<CardsTrainerPageProps> = ({
  currentUser,
  onRequireAuth,
  onRefreshStats,
}) => {
  const navigate = useNavigate();
  const {
    words,
    cardItems,
    loading,
    isCramMode,
    level,
    fetchWords,
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
      title="3D Флеш-карточки (SRS)"
      icon="🗂️"
      level={level}
      isCramMode={isCramMode}
      wordsCount={words.length}
      loading={loading}
      onBack={() => navigate('/trainers')}
      onGenerate={() => handleNeedMoreWords(35)}
    >
      <FlashcardDeck
        items={cardItems}
        onFinish={() => handleGameComplete(50)}
        onRefresh={fetchWords}
        onNeedMore={() => handleNeedMoreWords(35)}
      />
    </TrainerLayout>
  );
};
