import React from 'react';
import { StatsOverview } from '@/widgets/stats-panel/ui/StatsOverview';
import { UserStats } from '@/entities/user/model/types';

interface DashboardPageProps {
  stats: UserStats | null;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ stats }) => {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <StatsOverview stats={stats} />
    </div>
  );
};
