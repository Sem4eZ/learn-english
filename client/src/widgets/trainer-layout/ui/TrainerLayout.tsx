import React from 'react';
import { Button, Tag, Card, Typography, Spin } from 'antd';
import { ArrowLeftOutlined, ThunderboltFilled } from '@ant-design/icons';
import styles from './TrainerLayout.module.scss';

const { Title, Paragraph } = Typography;

export interface TrainerLayoutProps {
  title: string;
  icon: string;
  level: string;
  isCramMode?: boolean;
  wordsCount: number;
  loading: boolean;
  onBack: () => void;
  onGenerate?: () => void;
  children: React.ReactNode;
}

export const TrainerLayout: React.FC<TrainerLayoutProps> = ({
  title,
  icon,
  level,
  isCramMode = false,
  wordsCount,
  loading,
  onBack,
  onGenerate,
  children,
}) => {
  return (
    <div className={styles.container}>
      {/* Active Trainer Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            size="middle"
            className={styles.backBtn}
          >
            Назад к тренажерам
          </Button>
          <div className={styles.trainerTitleInfo}>
            <span className={styles.trainerIcon}>{icon}</span>
            <span className={styles.trainerTitle}>{title}</span>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {isCramMode && (
            <Tag color="green" className={styles.badgeTag}>
              🌟 Свободное повторение
            </Tag>
          )}
          {level !== 'all' && (
            <Tag color="purple" className={styles.badgeTag}>
              Уровень {level}
            </Tag>
          )}
          <Tag color="blue" className={styles.badgeTag}>
            {loading ? 'Загрузка...' : `${wordsCount} слов`}
          </Tag>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
          <div className={styles.loadingMessage}>
            ⚡ Загрузка и подготовка слов уровня <b>{level === 'all' ? 'Все уровни' : level}</b>...
          </div>
        </div>
      ) : wordsCount === 0 ? (
        <Card className={styles.emptyCard}>
          <Title level={4}>Нет доступных слов для уровня {level}</Title>
          <Paragraph type="secondary">
            Нажмите кнопку ниже, чтобы подготовить слова для этого уровня.
          </Paragraph>
          {onGenerate && (
            <Button
              type="primary"
              icon={<ThunderboltFilled />}
              onClick={onGenerate}
              loading={loading}
              size="large"
            >
              Сгенерировать слова для {level}
            </Button>
          )}
        </Card>
      ) : (
        <div className={styles.gameArea}>
          {children}
        </div>
      )}
    </div>
  );
};
