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
  ReloadOutlined,
  PlusCircleOutlined
} from '@ant-design/icons';
import { DictionaryItem } from '@/entities/dictionary';
import { dictionaryApi } from '@/entities/dictionary';
import { soundEffects } from '@/shared/lib/audio';
import { AuthUser } from '@/features/auth';
import styles from './DictionaryPage.module.scss';

const { Title, Text } = Typography;

interface DictionaryPageProps {
  onRefreshStats?: () => void;
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
}

export const DictionaryPage: React.FC<DictionaryPageProps> = ({ 
  onRefreshStats,
  currentUser,
  onRequireAuth
}) => {
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
    if (!currentUser) {
      message.warning('Для пополнения словаря войдите или зарегистрируйтесь');
      onRequireAuth?.();
      return;
    }
    setGenerating(true);
    try {
      const res = await dictionaryApi.generateWords(
        selectedLevel !== 'all' ? selectedLevel : 'B1',
        selectedSection !== 'all' ? selectedSection : 'general',
        25
      );
      if (res.success) {
        message.success(res.message || 'Словарь пополнен новыми словами!');
        setPage(1);
        fetchWords(search, 1, pageSize);
      } else {
        message.error('Не удалось пополнить словарь');
      }
    } catch (err: any) {
      message.error(err.message || 'Ошибка пополнения словаря');
    } finally {
      setGenerating(false);
    }
  };

  const handleLookupWord = async (wordToLookup: string) => {
    if (!currentUser) {
      message.warning('Для поиска и добавления слов войдите или зарегистрируйтесь');
      onRequireAuth?.();
      return;
    }
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
    if (!currentUser) {
      message.warning('Для добавления в избранное войдите или зарегистрируйтесь');
      onRequireAuth?.();
      return;
    }
    try {
      const updated = await dictionaryApi.toggleFavorite(id);
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            Интерактивный словарь
          </Title>
          <Text type="secondary" className={styles.headerSubtitle}>
            Тематическая лексика, идиомы, транскрипция, произношение и детальные примеры.
          </Text>
        </div>

        <Space wrap size="middle">
          <Button
            type="primary"
            icon={<PlusCircleOutlined className={styles.generateBtnIcon} />}
            size="large"
            loading={generating}
            onClick={handleGenerateWords}
            className={styles.generateBtn}
          >
            ✨ Пополнить новыми словами
          </Button>

          <Button
            icon={<ReloadOutlined />}
            size="large"
            onClick={() => fetchWords(search, page, pageSize)}
            title="Обновить список"
          >
            Обновить
          </Button>
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
                className={styles.lookupSuffixBtn}
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
          <div className={styles.lookupLoadingText}>
            Ищем слово «{search.trim()}», готовим перевод, транскрипцию и примеры...
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card className={styles.emptyCard}>
          {search.trim() ? (
            <div className={styles.emptySearchContainer}>
              <Empty description={<span>Слово <b>«{search.trim()}»</b> пока отсутствует в словаре</span>} />
              <div className={styles.emptySearchAction}>
                <Button
                  type="primary"
                  size="large"
                  loading={isLookingUp}
                  icon={<SearchOutlined />}
                  onClick={() => handleLookupWord(search.trim())}
                  className={styles.lookupAddBtn}
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
    </div>
  );
};

