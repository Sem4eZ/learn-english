import React, { useState, useEffect, useRef } from 'react';
import { 
  Input, 
  Button, 
  Card, 
  Typography, 
  Space, 
  Tag, 
  Select, 
  Segmented, 
  Spin, 
  Empty, 
  Modal,
  Pagination,
  message
} from 'antd';
import { 
  SearchOutlined, 
  SoundOutlined, 
  StarFilled, 
  StarOutlined, 
  AppstoreOutlined, 
  ThunderboltFilled, 
  ReloadOutlined,
  FireFilled,
  BookOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { dictionaryApi } from '@/entities/dictionary/api/dictionaryApi';
import { apiClient } from '@/shared/api/client';
import { soundEffects } from '@/shared/lib/audio';
import { FlashcardDeck, FlashcardItem } from '@/widgets/flashcard-deck/ui/FlashcardDeck';
import { VocabQuiz } from '@/widgets/vocab-quiz/ui/VocabQuiz';
import { SpeedSprint } from '@/widgets/speed-sprint/ui/SpeedSprint';
import { WordBuilder } from '@/widgets/word-builder/ui/WordBuilder';
import styles from './DictionaryPage.module.scss';

const { Title, Text } = Typography;

export const DictionaryPage: React.FC = () => {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);

  // Pagination states
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(24);
  const [total, setTotal] = useState<number>(0);
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);

  // Modals for all interactive training modes
  const [deckModalOpen, setDeckModalOpen] = useState<boolean>(false);
  const [quizModalOpen, setQuizModalOpen] = useState<boolean>(false);
  const [sprintModalOpen, setSprintModalOpen] = useState<boolean>(false);
  const [builderModalOpen, setBuilderModalOpen] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  // Ref to track the active query sequence and eliminate race conditions
  const activeRequestIdRef = useRef<number>(0);

  const fetchWords = async (
    searchTerm: string = search,
    targetPage: number = page,
    targetPageSize: number = pageSize
  ) => {
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);
    try {
      const res = await dictionaryApi.getDictionary({
        search: searchTerm,
        sectionId: selectedSection,
        level: selectedLevel,
        favoritesOnly,
        page: targetPage,
        limit: targetPageSize
      });
      // Only apply state if this is still the most recent request
      if (requestId === activeRequestIdRef.current) {
        setItems(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to load dictionary:', err);
      if (requestId === activeRequestIdRef.current) {
        setItems([]);
        setTotal(0);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleGenerateWords = async () => {
    setGenerating(true);
    try {
      const res: any = await apiClient.post('/dictionary/generate', {
        level: selectedLevel !== 'all' ? selectedLevel : 'B1',
        sectionId: selectedSection !== 'all' ? selectedSection : 'general',
        count: 25
      });
      if (res.success) {
        message.success(res.message || 'Словарь пополнен новыми словами!');
        setPage(1);
        fetchWords(search, 1, pageSize);
      } else {
        message.error(res.error || 'Не удалось пополнить словарь');
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка пополнения словаря');
    } finally {
      setGenerating(false);
    }
  };

  const handleLookupWord = async (wordToLookup: string) => {
    const term = wordToLookup.trim();
    if (!term) return;

    // Check if word is already present in current items list
    const alreadyPresent = items.find(
      w => w.word.toLowerCase() === term.toLowerCase() ||
           w.translation.toLowerCase() === term.toLowerCase()
    );
    if (alreadyPresent) {
      soundEffects.speak(alreadyPresent.word);
      message.info(`Слово «${alreadyPresent.word}» уже отображается в словаре`);
      return;
    }

    setIsLookingUp(true);
    try {
      const res = await dictionaryApi.lookupWord(term);
      if (res.success && res.data) {
        message.success(res.message || `Слово «${res.data.word}» добавлено в словарь!`);
        setItems(prev => {
          const exists = prev.some(w => w.id === res.data.id);
          if (exists) return prev;
          return [res.data, ...prev];
        });
        if (res.isNew) {
          setTotal(prev => prev + 1);
        }
        soundEffects.speak(res.data.word);
      } else {
        message.error(res.error || 'Не удалось найти слово');
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка поиска слова');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePageChange = (newPage: number, newPageSize: number) => {
    setPage(newPage);
    setPageSize(newPageSize);
    fetchWords(search, newPage, newPageSize);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(() => {
      fetchWords(search, 1, pageSize);
    }, 200);
    return () => clearTimeout(timer);
  }, [search, selectedSection, selectedLevel, favoritesOnly]);

  const handleToggleFav = async (id: number) => {
    try {
      const updated = await dictionaryApi.toggleFavorite(id);
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  // Convert dictionary items to flashcard items
  const flashcardItems: FlashcardItem[] = items.map(item => ({
    id: item.id,
    frontMain: item.word,
    frontPhonetic: item.transcription,
    frontContext: item.example_sentence,
    backMain: item.translation,
    backDetail: item.definition,
    backGrammar: item.example_translation,
    level: item.level,
    category: item.section_id
  }));

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            Интерактивный словарь
          </Title>
          <Text type="secondary" style={{ fontSize: '1rem' }}>
            Тематическая лексика, идиомы, транскрипция, произношение и тренировка в карточках.
          </Text>
        </div>

        <Space wrap size="middle">
          <Button
            type="primary"
            icon={<ThunderboltFilled />}
            size="large"
            onClick={() => setQuizModalOpen(true)}
            disabled={items.length < 2}
            className={styles.quizBtn}
          >
            🎯 Квиз 1 из 4 ({total || items.length})
          </Button>

          <Button
            icon={<AppstoreOutlined />}
            size="large"
            onClick={() => setDeckModalOpen(true)}
            disabled={items.length === 0}
            className={styles.trainCardsBtn}
          >
            🗂️ 3D Карточки
          </Button>

          <Button
            icon={<FireFilled style={{ color: '#f59e0b' }} />}
            size="large"
            onClick={() => setSprintModalOpen(true)}
            disabled={items.length < 2}
          >
            ⚡ Спринт
          </Button>

          <Button
            icon={<BookOutlined />}
            size="large"
            onClick={() => setBuilderModalOpen(true)}
            disabled={items.length === 0}
          >
            🧩 Спеллинг
          </Button>

          <Button
            icon={<PlusCircleOutlined style={{ color: '#10b981' }} />}
            size="large"
            loading={generating}
            onClick={handleGenerateWords}
            style={{ fontWeight: 600 }}
          >
            ✨ Пополнить новыми словами
          </Button>

          <Button
            icon={<ReloadOutlined />}
            size="large"
            onClick={() => fetchWords(search, page, pageSize)}
            title="Обновить"
          />
        </Space>
      </div>

      {/* Search Input */}
      <div className={styles.searchBar}>
        <Input
          size="large"
          placeholder="Поиск по слову, переводу или определению (нажмите Enter для поиска и добавления)..."
          prefix={<SearchOutlined className={styles.searchIcon} />}
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          onPressEnter={() => {
            if (search.trim()) {
              handleLookupWord(search.trim());
            }
          }}
          className={styles.searchInput}
          suffix={
            search.trim() ? (
              <Button
                type="primary"
                size="small"
                loading={isLookingUp}
                icon={<SearchOutlined />}
                onClick={() => handleLookupWord(search.trim())}
                style={{ borderRadius: 6 }}
              >
                Найти / Добавить
              </Button>
            ) : null
          }
        />
      </div>

      {/* Filter Chips Bar */}
      <div className={styles.filtersRow}>
        <Space wrap>
          <Segmented
            options={[
              { label: 'Все слова', value: 'all' },
              { label: '⭐ Избранное', value: 'favorites' },
            ]}
            value={favoritesOnly ? 'favorites' : 'all'}
            onChange={val => setFavoritesOnly(val === 'favorites')}
          />

          <Select
            value={selectedSection}
            onChange={setSelectedSection}
            className={styles.sectionSelect}
            options={[
              { label: 'Все курсы и темы', value: 'all' },
              { label: 'IT и разработка', value: 'tech_it' },
              { label: 'Деловой английский', value: 'business' },
              { label: 'Фразовые и идиомы', value: 'phrasal_idioms' },
              { label: 'Разговорный и сленг', value: 'conversational' },
              { label: 'Путешествия', value: 'travel' },
              { label: 'IELTS / TOEFL', value: 'ielts_toefl' },
              { label: 'Грамматика', value: 'grammar' },
            ]}
          />

          <Select
            value={selectedLevel}
            onChange={setSelectedLevel}
            className={styles.levelSelect}
            options={[
              { label: 'Любой CEFR', value: 'all' },
              { label: 'A2', value: 'A2' },
              { label: 'B1', value: 'B1' },
              { label: 'B2', value: 'B2' },
              { label: 'C1', value: 'C1' },
            ]}
          />
        </Space>

        <Text type="secondary" strong>
          Найдено слов: {total}
        </Text>
      </div>

      {/* Words Grid & On-demand Lookup */}
      {loading ? (
        <div className={styles.loadingWrapper}>
          <Spin size="large" />
        </div>
      ) : isLookingUp ? (
        <Card className={styles.emptyCard}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: 'var(--ant-color-text)', fontSize: '1.05rem', fontWeight: 600 }}>
            Ищем слово «{search.trim()}», готовим перевод, транскрипцию и примеры...
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card className={styles.emptyCard}>
          {search.trim() ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Empty description={<span>Слово <b>«{search.trim()}»</b> пока отсутствует в словаре</span>} />
              <div style={{ marginTop: 20 }}>
                <Button
                  type="primary"
                  size="large"
                  loading={isLookingUp}
                  icon={<SearchOutlined />}
                  onClick={() => handleLookupWord(search.trim())}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    borderColor: '#6366f1',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  Найти перевод и добавить «{search.trim()}» в словарь
                </Button>
              </div>
            </div>
          ) : (
            <Empty description="Слов по вашему запросу не найдено" />
          )}
        </Card>
      ) : (
        <>
          <div className={styles.wordsGrid}>
            {items.map(item => (
              <Card key={item.id} className={styles.wordCard} bordered>
                <div>
                  <div className={styles.cardTop}>
                    <Space align="center">
                      <span className={styles.wordHeading}>
                        {item.word}
                      </span>
                      {item.transcription && (
                        <span className={styles.phonetic}>
                          {item.transcription}
                        </span>
                      )}
                    </Space>

                    <Space size="small">
                      <Button
                        type="text"
                        shape="circle"
                        icon={<SoundOutlined className={styles.soundIcon} />}
                        onClick={() => soundEffects.speak(item.word)}
                        title="Прослушать произношение"
                      />

                      <Button
                        type="text"
                        shape="circle"
                        icon={
                          item.is_favorite ? (
                            <StarFilled className={styles.favIconActive} />
                          ) : (
                            <StarOutlined className={styles.favIconInactive} />
                          )
                        }
                        onClick={() => handleToggleFav(item.id)}
                        title={item.is_favorite ? 'В избранном' : 'Добавить в избранное'}
                      />
                    </Space>
                  </div>

                  <Space size="small" className={styles.badgeRow}>
                    <Tag color="purple">{item.level}</Tag>
                    {item.part_of_speech && <Tag color="blue">{item.part_of_speech}</Tag>}
                    {item.section_id && <Tag color="cyan">{item.section_id}</Tag>}
                  </Space>

                  <div className={styles.translation}>
                    {item.translation}
                  </div>

                  {item.definition && (
                    <div className={styles.definition}>
                      {item.definition}
                    </div>
                  )}

                  {item.example_sentence && (
                    <div className={styles.exampleBox}>
                      <div className={styles.exampleEn}>
                        "{item.example_sentence}"
                      </div>
                      {item.example_translation && (
                        <div className={styles.exampleRu}>
                          {item.example_translation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className={styles.paginationRow}>
              <Pagination
                current={page}
                pageSize={pageSize}
                total={total}
                showSizeChanger
                pageSizeOptions={['24', '48', '96']}
                onChange={handlePageChange}
                showTotal={(all, range) => `${range[0]}-${range[1]} из ${all} слов`}
              />
            </div>
          )}
        </>
      )}

      {/* Flashcards Deck Modal */}
      <Modal
        title={
          <span>
            <AppstoreOutlined style={{ marginRight: 8, color: '#6366f1' }} />
            Тренировка карточек словаря
          </span>
        }
        open={deckModalOpen}
        onCancel={() => setDeckModalOpen(false)}
        footer={null}
        width={920}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <FlashcardDeck
            items={flashcardItems}
            onFinish={() => {}}
          />
        </div>
      </Modal>

      {/* Vocab Quiz Modal (1 of 4 choices) */}
      <Modal
        title={
          <span>
            <ThunderboltFilled style={{ marginRight: 8, color: '#06b6d4' }} />
            Квиз по запоминанию: выбор 1 из 4
          </span>
        }
        open={quizModalOpen}
        onCancel={() => setQuizModalOpen(false)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <VocabQuiz
            words={items}
            onClose={() => setQuizModalOpen(false)}
          />
        </div>
      </Modal>

      {/* Speed Sprint Modal (60s) */}
      <Modal
        title={
          <span>
            <FireFilled style={{ marginRight: 8, color: '#f59e0b' }} />
            Скоростной спринт на 60 секунд
          </span>
        }
        open={sprintModalOpen}
        onCancel={() => setSprintModalOpen(false)}
        footer={null}
        width={720}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <SpeedSprint
            words={items}
            onClose={() => setSprintModalOpen(false)}
          />
        </div>
      </Modal>

      {/* Word Builder Modal (Spelling) */}
      <Modal
        title={
          <span>
            <BookOutlined style={{ marginRight: 8, color: '#a855f7' }} />
            Конструктор слов и спеллинг
          </span>
        }
        open={builderModalOpen}
        onCancel={() => setBuilderModalOpen(false)}
        footer={null}
        width={760}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <WordBuilder
            words={items}
            onClose={() => setBuilderModalOpen(false)}
          />
        </div>
      </Modal>
    </div>
  );
};
