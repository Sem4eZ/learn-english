import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Tag, Typography, Switch, Space, Button, Empty, Spin, Segmented } from 'antd';
import { 
  CheckCircleFilled, 
  CloseCircleFilled, 
  SoundOutlined, 
  ReloadOutlined,
  BookOutlined,
  ThunderboltFilled
} from '@ant-design/icons';
import { HistoryItem } from '@/entities/user/model/types';
import { userApi } from '@/entities/user/api/userApi';
import { soundEffects } from '@/shared/lib/audio';
import styles from './HistoryPage.module.scss';

const { Title, Text, Paragraph } = Typography;

type HistoryFilterType = 'all' | 'vocab' | 'grammar';

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<HistoryFilterType>('all');

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

  const filteredHistory = useMemo(() => {
    if (typeFilter === 'all') return history;
    return history.filter(item => item.type === typeFilter);
  }, [history, typeFilter]);

  const columns = [
    {
      title: 'Статус',
      dataIndex: 'is_correct',
      key: 'status',
      width: 110,
      render: (isCorrect: number, record: HistoryItem) => (
        isCorrect ? (
          <Tag color="success" icon={<CheckCircleFilled />}>Усвоено</Tag>
        ) : (
          <Tag color="error" icon={<CloseCircleFilled />}>
            {record.type === 'vocab' ? 'Снова' : 'Ошибка'}
          </Tag>
        )
      ),
    },
    {
      title: 'Тип и раздел',
      key: 'type_section',
      width: 180,
      render: (_: any, record: HistoryItem) => (
        <Space direction="vertical" size={2}>
          <Space size={4} wrap>
            <Tag color={record.type === 'vocab' ? 'cyan' : 'blue'}>
              {record.type === 'vocab' ? 'Словарь' : 'Грамматика'}
            </Tag>
            {record.level && <Tag color="purple">{record.level}</Tag>}
          </Space>
          {record.section_id && (
            <Text type="secondary">
              {record.section_id}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Материал и разбор',
      key: 'material',
      render: (_: any, record: HistoryItem) => {
        if (record.type === 'vocab') {
          return (
            <div className={styles.vocabRow}>
              <div className={styles.vocabHeader}>
                <span className={styles.vocabWord}>{record.word}</span>
                {record.transcription && (
                  <span className={styles.vocabPhonetic}>{record.transcription}</span>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<SoundOutlined />}
                  onClick={() => record.word && soundEffects.speak(record.word)}
                  title="Озвучить"
                />
              </div>

              <div className={styles.vocabTranslation}>
                {record.translation}
              </div>

              {record.explanation && (
                <Paragraph type="secondary" className={styles.explanation}>
                  {record.explanation}
                </Paragraph>
              )}

              {record.grammar_rule && (
                <div className={styles.vocabContext}>
                  "{record.grammar_rule}"
                </div>
              )}
            </div>
          );
        }

        // Grammar Question Row
        return (
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
                title="Озвучить"
              />
            </div>

            <Paragraph type="secondary" className={styles.explanation}>
              💡 {record.explanation}
            </Paragraph>

            {record.grammar_rule && (
              <div className={styles.rule}>
                Правило: {record.grammar_rule}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Ответ / Результат',
      key: 'user_answer',
      width: 200,
      render: (_: any, record: HistoryItem) => {
        if (record.type === 'vocab') {
          return (
            <Space direction="vertical" size={2}>
              <Tag color={record.is_correct ? 'success' : 'warning'}>
                {record.is_correct ? 'Запомнил' : 'Нужно повторить'}
              </Tag>
              {record.reps !== undefined && (
                <Text type="secondary">
                  Повторений: {record.reps}
                </Text>
              )}
            </Space>
          );
        }

        const userChoice = record.options?.[record.selected_index ?? -1];
        const correctChoice = record.options?.[record.correct_index ?? -1];
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

  const vocabMistakesCount = history.filter(h => h.type === 'vocab' && !h.is_correct).length;
  const grammarMistakesCount = history.filter(h => h.type === 'grammar' && !h.is_correct).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            История ответов и работа над ошибками
          </Title>
          <Text type="secondary">
            Анализируйте изученные слова, пройденные тесты и тренируйте проблемные места
          </Text>
        </div>

        <div className={styles.filterRow}>
          <Segmented
            className={styles.modeSegmented}
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as HistoryFilterType)}
            options={[
              { label: `Все (${history.length})`, value: 'all' },
              { label: <><BookOutlined /> Словарь</>, value: 'vocab' },
              { label: <><ThunderboltFilled /> Грамматика</>, value: 'grammar' },
            ]}
          />

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
      </div>

      <Card bordered className={styles.card}>
        {loading ? (
          <div className={styles.loadingBox}>
            <Spin size="large" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <Empty 
            description={
              mistakesOnly 
                ? 'Отлично! Ошибок в выбранной категории пока нет.' 
                : 'История пока пуста. Начните тренироваться в тренажерах или словаре!'
            } 
          />
        ) : (
          <Table
            dataSource={filteredHistory}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        )}
      </Card>
    </div>
  );
};
