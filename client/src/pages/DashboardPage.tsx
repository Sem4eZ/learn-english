import React from 'react';
import { StatsOverview } from '@/widgets/stats-panel/ui/StatsOverview';
import { UserStats } from '@/entities/user/model/types';
import styles from './DashboardPage.module.scss';

interface DashboardPageProps {
  stats: UserStats | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ stats }) => {
  return (
    <div className={styles.container}>
      <StatsOverview stats={stats} />
    </div>
  );
};
