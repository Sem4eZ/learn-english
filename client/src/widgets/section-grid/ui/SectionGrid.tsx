import React from 'react';
import { Card, Row, Col, Typography, Button, Badge } from 'antd';
import { 
  BookOutlined, 
  RocketOutlined, 
  CodeOutlined, 
  CompassOutlined, 
  FireOutlined, 
  CommentOutlined, 
  TrophyOutlined, 
  ArrowRightOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Section } from '@/entities/section/model/types';
import styles from './SectionGrid.module.scss';

const { Title, Paragraph, Text } = Typography;

interface SectionGridProps {
  sections: Section[];
  onSelectSection: (sectionId: string) => void;
  onOpenGenerateModal: (sectionId: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  BookOutlined: <BookOutlined style={{ fontSize: 24, color: '#6366f1' }} />,
  RocketOutlined: <RocketOutlined style={{ fontSize: 24, color: '#06b6d4' }} />,
  CodeOutlined: <CodeOutlined style={{ fontSize: 24, color: '#10b981' }} />,
  CompassOutlined: <CompassOutlined style={{ fontSize: 24, color: '#f59e0b' }} />,
  FireOutlined: <FireOutlined style={{ fontSize: 24, color: '#ef4444' }} />,
  CommentOutlined: <CommentOutlined style={{ fontSize: 24, color: '#a855f7' }} />,
  TrophyOutlined: <TrophyOutlined style={{ fontSize: 24, color: '#ec4899' }} />,
};

export const SectionGrid: React.FC<SectionGridProps> = ({
  sections,
  onSelectSection,
  onOpenGenerateModal,
}) => {
  return (
    <div>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          Тематические курсы
        </Title>
        <Text type="secondary" className={styles.subtitle}>
          Комплексные программы и интерактивная практика по ключевым языковым направлениям.
        </Text>
      </div>

      <Row gutter={[20, 20]}>
        {sections.map(section => (
          <Col xs={24} sm={12} md={8} xl={6} key={section.id}>
            <Card
              hoverable
              className={styles.sectionCard}
              styles={{ body: { display: 'flex', flexDirection: 'column', height: '100%' } }}
              onClick={() => onSelectSection(section.id)}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    {ICON_MAP[section.icon] || <BookOutlined style={{ fontSize: 24, color: '#6366f1' }} />}
                  </div>

                  <Badge
                    count={section.question_count ? `${section.question_count} уроков` : 'Доступно'}
                    style={{
                      backgroundColor: section.question_count ? '#10b981' : '#6366f1',
                    }}
                  />
                </div>

                <Title level={4} className={styles.cardTitle}>
                  {section.title}
                </Title>

                <Paragraph type="secondary" className={styles.cardDescription}>
                  {section.description}
                </Paragraph>
              </div>

              <div className={styles.cardFooter}>
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSection(section.id);
                  }}
                  className={styles.trainButton}
                  block
                >
                  Начать курс
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
