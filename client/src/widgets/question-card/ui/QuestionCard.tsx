import React from 'react';
import { Card, Tag, Typography, Button, Space } from 'antd';
import { SoundOutlined } from '@ant-design/icons';
import { Question, AnswerResult } from '@/entities/question/model/types';
import { AnswerOptions } from '@/features/answer-question/ui/AnswerOptions';
import { soundEffects } from '@/shared/lib/audio';
import styles from './QuestionCard.module.scss';

const { Title, Paragraph } = Typography;

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  onAnswerSubmitted?: (result: AnswerResult) => void;
  onNext?: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionNumber,
  onAnswerSubmitted,
  onNext,
}) => {
  return (
    <Card
      bordered
      className={styles.card}
    >
      {/* Top Header */}
      <div className={styles.header}>
        <Space>
          <Tag color="blue" className={styles.tag}>
            Вопрос #{questionNumber}
          </Tag>
          <Tag color="purple" className={styles.tag}>
            Уровень: {question.level}
          </Tag>
        </Space>

        <Button
          type="text"
          shape="circle"
          icon={<SoundOutlined className={styles.audioButton} />}
          onClick={() => soundEffects.speak(question.question_text)}
          title="Прослушать вопрос"
        />
      </div>

      {/* Real-life Context (if present) */}
      {question.context_text && (
        <div className={styles.contextBox}>
          <span className={styles.contextLabel}>
            Контекст ситуации:
          </span>
          <Paragraph className={styles.contextText}>
            "{question.context_text}"
          </Paragraph>
        </div>
      )}

      {/* Main Question Text */}
      <Title level={3} className={styles.questionTitle}>
        {question.question_text}
      </Title>

      {/* Options and Feedback */}
      <AnswerOptions
        question={question}
        onAnswerSubmitted={onAnswerSubmitted}
        onNext={onNext}
      />
    </Card>
  );
};
