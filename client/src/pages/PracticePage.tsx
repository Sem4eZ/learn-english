import React, { useState, useEffect } from 'react';
import { Typography, Space, Button, Spin, Alert, Empty, Select } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Question } from '@/entities/question/model/types';
import { Section } from '@/entities/section/model/types';
import { questionApi } from '@/entities/question/api/questionApi';
import { QuestionCard } from '@/widgets/question-card/ui/QuestionCard';
import { SmartPagination } from '@/widgets/infinite-stream/ui/SmartPagination';
import { LevelSelect } from '@/features/filter-level/ui/LevelSelect';
import { GenerateBatchModal } from '@/features/generate-ai-batch/ui/GenerateBatchModal';
import styles from './PracticePage.module.scss';

const { Title, Text } = Typography;

interface PracticePageProps {
  section?: Section;
  allSections?: Section[];
  initialSectionId?: string;
  initialLevel?: string;
  onBack: () => void;
  onRefreshStats: () => void;
}

export const PracticePage: React.FC<PracticePageProps> = ({
  section,
  allSections = [],
  initialSectionId,
  initialLevel,
  onBack,
  onRefreshStats,
}) => {
  const [level, setLevel] = useState<string>(initialLevel || section?.default_level || 'B1');
  const [currentSectionId, setCurrentSectionId] = useState<string>(
    initialSectionId || section?.id || 'grammar'
  );
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState<boolean>(false);

  const fetchQuestions = async (
    targetPage = page,
    targetLevel = level,
    targetSection = currentSectionId
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await questionApi.getQuestions({
        sectionId: targetSection,
        level: targetLevel,
        page: targetPage,
        limit: pageSize,
      });

      setQuestions(res.data);
      setTotal(res.pagination.total);
    } catch (err: any) {
      console.error('Failed to load questions:', err);
      const raw = err.message || '';
      const clean = (raw.includes('503') || raw.includes('429') || raw.includes('Gemini') || raw.includes('{'))
        ? 'Сервер сейчас обрабатывает много запросов. Пожалуйста, повторите попытку через пару секунд.'
        : raw || 'Ошибка загрузки заданий';
      setError(clean);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions(1, level, currentSectionId);
  }, [currentSectionId, level]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchQuestions(newPage, level, currentSectionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    setPage(1);
    fetchQuestions(1, newLevel, currentSectionId);
  };

  const handleTopicChange = (newTopic: string) => {
    setCurrentSectionId(newTopic);
    setPage(1);
    fetchQuestions(1, level, newTopic);
  };

  const currentSection = allSections.find(s => s.id === currentSectionId) || section;

  return (
    <div>
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} size="large" onClick={onBack}>
            Назад ко всем тренажерам
          </Button>
          <div>
            <Title level={3} className={styles.sectionTitle}>
              {currentSection ? currentSection.title : '📘 Грамматика и конструкции'}
            </Title>
            <Text type="secondary" className={styles.sectionSubtitle}>
              Практические задания, вставка предлогов и пропущенных слов, разбор правил
            </Text>
          </div>
        </Space>

        <Space size="middle" wrap>
          <Space>
            <Text strong>Тема:</Text>
            <Select
              value={currentSectionId}
              onChange={handleTopicChange}
              style={{ minWidth: 200 }}
              options={[
                { label: 'Все темы (микс)', value: 'all' },
                ...(allSections.length > 0
                  ? allSections.map(s => ({ label: s.title, value: s.id }))
                  : [
                      { label: 'Грамматика и конструкции', value: 'grammar' },
                      { label: 'Деловой английский', value: 'business' },
                      { label: 'Разговорный английский', value: 'conversational' },
                      { label: 'Фразовые глаголы и идиомы', value: 'phrasal_idioms' },
                      { label: 'IT и разработка', value: 'tech_it' },
                      { label: 'Путешествия', value: 'travel' },
                      { label: 'IELTS / TOEFL', value: 'ielts_toefl' },
                    ])
              ]}
            />
          </Space>

          <Space>
            <Text strong>Уровень:</Text>
            <LevelSelect value={level} onChange={handleLevelChange} />
          </Space>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setGenerateModalOpen(true)}
            className={styles.addQuestionsBtn}
          >
            Добавить вопросы
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchQuestions(page, level, currentSectionId)}
            title="Обновить"
          />
        </Space>
      </div>

      {/* Main Questions Stream Area */}
      {loading ? (
        <div className={styles.loadingContainer}>
          <Spin size="large" />
          <div className={styles.loadingText}>
            <Title level={4}>Загрузка заданий...</Title>
            <Text type="secondary">
              Подготавливаем практические задания и разбор
            </Text>
          </div>
        </div>
      ) : error ? (
        <Alert
          type="error"
          message="Не удалось загрузить вопросы"
          description={error}
          action={
            <Button size="small" type="primary" onClick={() => fetchQuestions(page, level, currentSectionId)}>
              Повторить
            </Button>
          }
          showIcon
          className={styles.errorAlert}
        />
      ) : questions.length === 0 ? (
        <Empty
          description="Пока нет вопросов для этой темы и уровня"
          className={styles.emptyContainer}
        >
          <Button type="primary" onClick={() => setGenerateModalOpen(true)}>
            Сформировать вопросы
          </Button>
        </Empty>
      ) : (
        <div>
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              questionNumber={(page - 1) * pageSize + idx + 1}
              onAnswerSubmitted={() => {
                onRefreshStats();
              }}
              onNext={() => {
                const cards = document.querySelectorAll('.ant-card');
                const nextCard = cards[idx + 1];
                if (nextCard) {
                  nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                  handlePageChange(page + 1);
                }
              }}
            />
          ))}

          {/* Smart Infinite Pagination */}
          <SmartPagination
            currentPage={page}
            pageSize={pageSize}
            total={total}
            onChange={handlePageChange}
            loading={loading}
          />
        </div>
      )}

      {/* Custom AI Generation Modal */}
      <GenerateBatchModal
        visible={generateModalOpen}
        sections={allSections}
        initialSectionId={currentSectionId !== 'all' ? currentSectionId : 'grammar'}
        initialLevel={level}
        onClose={() => setGenerateModalOpen(false)}
        onGenerated={() => {
          fetchQuestions(page, level, currentSectionId);
        }}
      />
    </div>
  );
};
