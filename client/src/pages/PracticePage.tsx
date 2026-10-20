import React, { useState, useEffect } from 'react';
import { Typography, Button, Spin, Alert, Empty, Tag } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Question } from '@/entities/question';
import { Section } from '@/entities/section';
import { questionApi } from '@/entities/question';
import { QuestionCard } from '@/widgets/question-card';
import { SmartPagination } from '@/widgets/infinite-stream';
import { GenerateBatchModal } from '@/features/generate-ai-batch';
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

  useEffect(() => {
    if (initialLevel) setLevel(initialLevel);
  }, [initialLevel]);

  useEffect(() => {
    if (initialSectionId) setCurrentSectionId(initialSectionId);
  }, [initialSectionId]);

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
    fetchQuestions(page, level, currentSectionId);
  }, [currentSectionId, level, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const currentSection = allSections.find(s => s.id === currentSectionId) || section;

  return (
    <div>
      {/* Top Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarHeader}>
          <div className={styles.leftGroup}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              size="middle" 
              onClick={onBack} 
              className={styles.backButton}
            >
              Назад к тренажерам
            </Button>
            <div className={styles.titleWrapper}>
              <div className={styles.titleRow}>
                <Title level={3} className={styles.sectionTitle}>
                  {currentSection ? currentSection.title : '📘 Грамматика и конструкции'}
                </Title>
                <div className={styles.badgesGroup}>
                  {level && level !== 'all' && (
                    <Tag color="purple" className={styles.infoBadge}>
                      Уровень {level}
                    </Tag>
                  )}
                  {currentSection && currentSectionId !== 'all' && (
                    <Tag color="blue" className={styles.infoBadge}>
                      {currentSection.title.split('(')[0].trim()}
                    </Tag>
                  )}
                </div>
              </div>
              <Text type="secondary" className={styles.sectionSubtitle}>
                Практические задания, вставка предлогов и пропущенных слов, разбор правил
              </Text>
            </div>
          </div>

          <div className={styles.actionGroup}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setGenerateModalOpen(true)}
              className={styles.addQuestionsBtn}
            >
              Добавить
            </Button>

            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchQuestions(page, level, currentSectionId)}
              title="Обновить задания"
            />
          </div>
        </div>
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
