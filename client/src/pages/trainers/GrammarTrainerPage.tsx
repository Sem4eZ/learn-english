import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PracticePage } from '@/pages/PracticePage';
import { Section } from '@/entities/section/model/types';

export interface GrammarTrainerPageProps {
  allSections?: Section[];
  onRefreshStats?: () => void;
}

export const GrammarTrainerPage: React.FC<GrammarTrainerPageProps> = ({
  allSections = [],
  onRefreshStats,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level') || 'B1';
  const category = searchParams.get('category') || 'grammar';

  return (
    <PracticePage
      allSections={allSections}
      initialSectionId={category}
      initialLevel={level}
      onBack={() => navigate('/trainers')}
      onRefreshStats={() => onRefreshStats?.()}
    />
  );
};
