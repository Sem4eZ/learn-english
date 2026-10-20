import React from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { AudioChallenge } from '@/widgets/audio-challenge';
import { TrainerLayout } from '@/widgets/trainer-layout';
import { useTrainerWords } from '@/features/trainer-session';
import { AuthUser } from '@/features/auth';

export interface AudioTrainerPageProps {
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
  onRefreshStats?: () => void;
}

export const AudioTrainerPage: React.FC<AudioTrainerPageProps> = ({
  currentUser,
  onRequireAuth,
  onRefreshStats,
}) => {
  const navigate = useNavigate();
  const {
    words,
    audioItems,
    loading,
    isCramMode,
    level,
    category,
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
      title="Аудирование и диктант"
      icon="🎧"
      level={level}
      category={category}
      isCramMode={isCramMode}
      wordsCount={words.length}
      loading={loading}
      onBack={() => navigate('/trainers')}
      onGenerate={() => handleNeedMoreWords(35)}
    >
      <AudioChallenge
        items={audioItems}
        onComplete={(score) => handleGameComplete(score)}
        onRefresh={fetchWords}
        onNeedMore={() => handleNeedMoreWords(35)}
      />
    </TrainerLayout>
  );
};
