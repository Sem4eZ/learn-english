import React, { useEffect, useRef } from 'react';
import { StatsOverview } from '@/widgets/stats-panel/ui/StatsOverview';
import { UserStats } from '@/entities/user/model/types';
import styles from './DashboardPage.module.scss';

interface DashboardPageProps {
  stats: UserStats | null;
  onRefreshStats?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ stats, onRefreshStats }) => {
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      onRefreshStats?.();
    }
  }, [onRefreshStats]);

  return (
    <div className={styles.container}>
      <StatsOverview stats={stats} onRefreshStats={onRefreshStats} />
    </div>
  );
};
