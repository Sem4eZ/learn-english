import React from 'react';
import { Card, Row, Col, Progress, Typography, Space, Table, Tag } from 'antd';
import { FireFilled, ThunderboltFilled, TrophyFilled, CheckCircleOutlined } from '@ant-design/icons';
import { UserStats } from '@/entities/user/model/types';
import styles from './StatsOverview.module.scss';

const { Title, Text } = Typography;

interface StatsOverviewProps {
  stats: UserStats | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) return null;

  const level = stats.level || 1;
  const progressPercent = stats.levelPercent || 0;
  const accuracy = stats.accuracy || 0;

  const columns = [
    {
      title: 'Курс',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Всего попыток',
      dataIndex: 'attempted',
      key: 'attempted',
      render: (val: number) => <Tag color="blue">{val || 0}</Tag>,
    },
    {
      title: 'Правильно',
      dataIndex: 'correct',
      key: 'correct',
      render: (val: number) => <Tag color="green">{val || 0}</Tag>,
    },
    {
      title: 'Точность',
      key: 'acc',
      render: (_: any, record: any) => {
        const acc = record.attempted > 0 ? Math.round((record.correct / record.attempted) * 100) : 0;
        return <Progress percent={acc} size="small" className={styles.progressMini} />;
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" className={styles.container}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          Дашборд прогресса
        </Title>
        <Text type="secondary" className={styles.subtitle}>
          Статистика обучения, очки опыта (XP) и анализ точности ответов.
        </Text>
      </div>

      <Row gutter={[20, 20]}>
        {/* Level & XP */}
        <Col xs={24} sm={12} lg={6}>
          <Card bordered className={styles.statCard}>
            <div className={styles.statHeader}>
              <TrophyFilled className={`${styles.statIcon} ${styles.iconPurple}`} />
              <div>
                <Text type="secondary" className={styles.statLabel}>
                  Звание и уровень
                </Text>
                <Title level={3} className={styles.statTitle}>
                  Уровень {level}
                </Title>
              </div>
            </div>
            <Progress percent={progressPercent} strokeColor={{ '0%': '#6366f1', '100%': '#a855f7' }} />
            <Text type="secondary" className={styles.statFooter}>
              {stats.progressXP} / {stats.neededXP} XP до след. уровня
            </Text>
          </Card>
        </Col>

        {/* Streak */}
        <Col xs={24} sm={12} lg={6}>
          <Card bordered className={styles.statCard}>
            <div className={styles.statHeader}>
              <FireFilled className={`${styles.statIcon} ${styles.iconAmber}`} />
              <div>
                <Text type="secondary" className={styles.statLabel}>
                  Серия дней (Streak)
                </Text>
                <Title level={3} className={styles.statTitle}>
                  {stats.streak} {stats.streak === 1 ? 'день' : 'дня'}
                </Title>
              </div>
            </div>
            <Text type="secondary">
              Занимайтесь каждый день, чтобы сохранять огонь обучения!
            </Text>
          </Card>
        </Col>

        {/* Total XP */}
        <Col xs={24} sm={12} lg={6}>
          <Card bordered className={styles.statCard}>
            <div className={styles.statHeader}>
              <ThunderboltFilled className={`${styles.statIcon} ${styles.iconCyan}`} />
              <div>
                <Text type="secondary" className={styles.statLabel}>
                  Всего заработано
                </Text>
                <Title level={3} className={styles.statTitle}>
                  {stats.xp} XP
                </Title>
              </div>
            </div>
            <Text type="secondary">
              +{stats.correctAnswered * 15} XP за верные ответы
            </Text>
          </Card>
        </Col>

        {/* Accuracy */}
        <Col xs={24} sm={12} lg={6}>
          <Card bordered className={styles.statCard}>
            <div className={styles.statHeader}>
              <CheckCircleOutlined className={`${styles.statIcon} ${styles.iconEmerald}`} />
              <div>
                <Text type="secondary" className={styles.statLabel}>
                  Общая точность
                </Text>
                <Title level={3} className={styles.statTitle}>
                  {accuracy}%
                </Title>
              </div>
            </div>
            <Progress 
              percent={accuracy} 
              strokeColor={accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444'} 
              showInfo={false}
            />
            <Text type="secondary" className={styles.accuracyFooter}>
              {stats.correctAnswered} из {stats.totalAnswered} ответов верно
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Breakdown by course */}
      <Card title="Успеваемость по курсам" bordered className={styles.tableCard}>
        <Table
          dataSource={stats.sectionBreakdown}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
      </Card>
    </Space>
  );
};
