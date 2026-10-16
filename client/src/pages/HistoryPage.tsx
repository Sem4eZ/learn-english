import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Typography, Switch, Space, Button, Empty, Spin } from 'antd';
import { CheckCircleFilled, CloseCircleFilled, SoundOutlined, ReloadOutlined } from '@ant-design/icons';
import { HistoryItem } from '@/entities/user/model/types';
import { userApi } from '@/entities/user/api/userApi';
import { soundEffects } from '@/shared/lib/audio';
import styles from './HistoryPage.module.scss';

const { Title, Text, Paragraph } = Typography;

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mistakesOnly, setMistakesOnly] = useState(false);

  const fetchHistory = async (onlyMistakes = mistakesOnly) => {
    setLoading(true);
    try {
      const data = await userApi.getHistory(onlyMistakes);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(mistakesOnly);
  }, [mistakesOnly]);

  const columns = [
    {
      title: 'Статус',
      dataIndex: 'is_correct',
      key: 'status',
      width: 90,
      render: (isCorrect: number) => (
        isCorrect ? (
          <Tag color="success" icon={<CheckCircleFilled />}>Верно</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleFilled />}>Ошибка</Tag>
        )
      ),
    },
    {
      title: 'Вопрос и объяснение',
      key: 'question',
      render: (_: any, record: HistoryItem) => (
        <div>
          <div className={styles.questionHeader}>
            <Text strong className={styles.questionText}>
              {record.question_text}
            </Text>
            <Button
              type="text"
              size="small"
              icon={<SoundOutlined />}
              onClick={() => soundEffects.speak(record.question_text)}
            />
          </div>

          <Space size="small" className={styles.tagsRow}>
            <Tag color="purple">Уровень: {record.level}</Tag>
            <Tag color="blue">{record.section_id}</Tag>
          </Space>

          <Paragraph type="secondary" className={styles.explanation}>
            💡 {record.explanation}
          </Paragraph>

          {record.grammar_rule && (
            <div className={styles.rule}>
              Правило: {record.grammar_rule}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Ваш ответ',
      key: 'user_answer',
      width: 180,
      render: (_: any, record: HistoryItem) => {
        const userChoice = record.options[record.selected_index];
        const correctChoice = record.options[record.correct_index];
        return (
          <div>
            <div className={`${styles.userChoice} ${record.is_correct ? styles.correct : styles.wrong}`}>
              {userChoice || '—'}
            </div>
            {!record.is_correct && (
              <div className={styles.correctChoice}>
                Верно: {correctChoice}
              </div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            История ответов и работа над ошибками
          </Title>
          <Text type="secondary">
            Анализируйте свои ответы и повторяйте сложные грамматические моменты
          </Text>
        </div>

        <Space size="middle">
          <Space>
            <Text strong>Только ошибки:</Text>
            <Switch
              checked={mistakesOnly}
              onChange={(checked) => setMistakesOnly(checked)}
            />
          </Space>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchHistory()}
            title="Обновить"
          />
        </Space>
      </div>

      <Card bordered className={styles.card}>
        {loading ? (
          <div className={styles.loadingBox}>
            <Spin size="large" />
          </div>
        ) : history.length === 0 ? (
          <Empty description="История пока пуста. Начните проходить один из курсов!" />
        ) : (
          <Table
            dataSource={history}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  );
};
