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
import { Section } from '@/entities/section';
import styles from './SectionGrid.module.scss';

const { Title, Paragraph, Text } = Typography;

interface SectionGridProps {
  sections: Section[];
  onSelectSection: (sectionId: string) => void;
  onOpenGenerateModal: (sectionId: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  BookOutlined: <BookOutlined className={`${styles.sectionIcon} ${styles.iconIndigo}`} />,
  RocketOutlined: <RocketOutlined className={`${styles.sectionIcon} ${styles.iconCyan}`} />,
  CodeOutlined: <CodeOutlined className={`${styles.sectionIcon} ${styles.iconEmerald}`} />,
  CompassOutlined: <CompassOutlined className={`${styles.sectionIcon} ${styles.iconAmber}`} />,
  FireOutlined: <FireOutlined className={`${styles.sectionIcon} ${styles.iconRose}`} />,
  CommentOutlined: <CommentOutlined className={`${styles.sectionIcon} ${styles.iconPurple}`} />,
  TrophyOutlined: <TrophyOutlined className={`${styles.sectionIcon} ${styles.iconPink}`} />,
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
              onClick={() => onSelectSection(section.id)}
            >
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>
                    {ICON_MAP[section.icon] || <BookOutlined className={`${styles.sectionIcon} ${styles.iconIndigo}`} />}
                  </div>

                  <Badge
                    count={section.question_count ? `${section.question_count} уроков` : 'Доступно'}
                    className={section.question_count ? styles.badgeActive : styles.badgeDefault}
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
