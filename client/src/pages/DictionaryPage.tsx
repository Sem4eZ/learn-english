import React, { useState, useEffect } from 'react';
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
  PlayCircleFilled,
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

const { Title, Text, Paragraph } = Typography;

export const DictionaryPage: React.FC = () => {
  const [items, setItems] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);

  // Modals for all interactive training modes
  const [deckModalOpen, setDeckModalOpen] = useState<boolean>(false);
  const [quizModalOpen, setQuizModalOpen] = useState<boolean>(false);
  const [sprintModalOpen, setSprintModalOpen] = useState<boolean>(false);
  const [builderModalOpen, setBuilderModalOpen] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);

  const handleGenerateWords = async () => {
    setGenerating(true);
    try {
      const res: any = await apiClient.post('/dictionary/generate', {
        level: selectedLevel !== 'all' ? selectedLevel : 'B1',
        sectionId: selectedSection !== 'all' ? selectedSection : 'general',
        count: 10
      });
      if (res.success) {
        message.success(res.message || 'Словарь пополнен новыми словами!');
        fetchWords();
      } else {
        message.error(res.error || 'Не удалось пополнить словарь');
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка пополнения словаря');
    } finally {
      setGenerating(false);
    }
  };

  const fetchWords = async () => {
    setLoading(true);
    try {
      const res = await dictionaryApi.getDictionary({
        search,
        sectionId: selectedSection,
        level: selectedLevel,
        favoritesOnly,
        limit: 50
      });
      setItems(res.data);
    } catch (err) {
      console.error('Failed to load dictionary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWords();
    }, 250);
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
            🎯 Квиз 1 из 4 ({items.length})
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
            onClick={fetchWords}
            title="Обновить"
          />
        </Space>
      </div>

      {/* Search Input */}
      <div className={styles.searchBar}>
        <Input
          size="large"
          placeholder="Поиск по слову, переводу или определению (например, bottleneck, touch base, компромисс)..."
          prefix={<SearchOutlined className={styles.searchIcon} />}
          allowClear
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
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
          Найдено слов: {items.length}
        </Text>
      </div>

      {/* Words Grid */}
      {loading ? (
        <div className={styles.loadingWrapper}>
          <Spin size="large" />
        </div>
      ) : items.length === 0 ? (
        <Card className={styles.emptyCard}>
          <Empty description="Слов по вашему запросу не найдено" />
        </Card>
      ) : (
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
