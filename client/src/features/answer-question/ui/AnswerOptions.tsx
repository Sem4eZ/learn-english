import React, { useState } from 'react';
import { Button, Card, Typography, Space, Alert, Tag } from 'antd';
import { 
  CheckCircleFilled, 
  CloseCircleFilled, 
  SoundOutlined, 
  BulbOutlined, 
  InfoCircleOutlined 
} from '@ant-design/icons';
import { Question, AnswerResult } from '@/entities/question/model/types';
import { questionApi } from '@/entities/question/api/questionApi';
import { soundEffects } from '@/shared/lib/audio';
import { fireCelebration } from '@/shared/lib/confetti';
import styles from './AnswerOptions.module.scss';

const { Text, Paragraph } = Typography;

interface AnswerOptionsProps {
  question: Question;
  onAnswerSubmitted?: (result: AnswerResult) => void;
  onNext?: () => void;
}

export const AnswerOptions: React.FC<AnswerOptionsProps> = ({
  question,
  onAnswerSubmitted,
  onNext,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSelect = async (idx: number) => {
    if (selectedIdx !== null || submitting) return;
    setSelectedIdx(idx);
    setSubmitting(true);

    try {
      const res = await questionApi.submitAnswer({
        questionId: question.id,
        selectedIndex: idx,
      });

      setResult(res);
      if (res.isCorrect) {
        soundEffects.playCorrect();
        if (res.streak >= 3) {
          fireCelebration();
        }
      } else {
        soundEffects.playWrong();
      }

      onAnswerSubmitted?.(res);
    } catch (err) {
      console.error('Answer submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isAnswered = selectedIdx !== null && result !== null;

  return (
    <div className={styles.container}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div className={styles.optionsGrid}>
          {question.options.map((option, idx) => {
            const isThisSelected = selectedIdx === idx;
            const isThisCorrect = isAnswered && result.correctIndex === idx;
            const isThisWrong = isAnswered && isThisSelected && !result.isCorrect;

            let buttonClass = styles.optionButton;
            if (isThisCorrect) buttonClass += ` ${styles.correct}`;
            else if (isThisWrong) buttonClass += ` ${styles.wrong}`;

            return (
              <Button
                key={idx}
                type="default"
                className={buttonClass}
                disabled={isAnswered}
                loading={submitting && selectedIdx === idx}
                onClick={() => handleSelect(idx)}
              >
                <span>
                  <strong className={styles.optionLetter}>{String.fromCharCode(65 + idx)}.</strong>
                  {option}
                </span>

                {isThisCorrect && <CheckCircleFilled style={{ color: '#10b981', fontSize: 20 }} />}
                {isThisWrong && <CloseCircleFilled style={{ color: '#ef4444', fontSize: 20 }} />}
              </Button>
            );
          })}
        </div>

        {/* Detailed Explanation Accordion/Alert */}
        {isAnswered && (
          <Card
            bordered
            className={`${styles.explanationCard} ${result.isCorrect ? styles.correct : styles.wrong}`}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div className={styles.cardHeader}>
                <Space>
                  <Tag color={result.isCorrect ? 'success' : 'error'} style={{ fontSize: '0.9rem', padding: '4px 10px' }}>
                    {result.isCorrect ? 'Верно! (+15 XP)' : 'Неверно (+5 XP)'}
                  </Tag>
                  {result.streak >= 2 && (
                    <Tag color="warning">🔥 Серия: {result.streak}</Tag>
                  )}
                </Space>

                <Button
                  type="text"
                  icon={<SoundOutlined />}
                  onClick={() => soundEffects.speak(question.question_text)}
                >
                  Озвучить
                </Button>
              </div>

              <Paragraph className={styles.explanationText}>
                <InfoCircleOutlined style={{ marginRight: 6, color: '#6366f1' }} />
                {result.explanation}
              </Paragraph>

              {result.grammarRule && (
                <Alert
                  type="info"
                  showIcon
                  icon={<BulbOutlined />}
                  message="Грамматическое правило / Нюанс:"
                  description={result.grammarRule}
                  className={styles.ruleAlert}
                />
              )}

              {result.pronunciationTip && (
                <Text type="secondary" className={styles.phoneticsTip}>
                  💡 Фонетика: {result.pronunciationTip}
                </Text>
              )}

              {onNext && (
                <div className={styles.nextButtonWrapper}>
                  <Button type="primary" size="large" onClick={onNext} className={styles.nextButton}>
                    Следующий вопрос ➔
                  </Button>
                </div>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
};
