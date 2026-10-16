import React from 'react';
import { Pagination, Space, Typography } from 'antd';
import styles from './SmartPagination.module.scss';

const { Text } = Typography;

interface SmartPaginationProps {
  currentPage: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  loading?: boolean;
}

export const SmartPagination: React.FC<SmartPaginationProps> = ({
  currentPage,
  pageSize,
  total,
  onChange,
  loading = false,
}) => {
  return (
    <div className={styles.paginationContainer}>
      <Space size="middle">
        <Text type="secondary" className={styles.hintText}>
          Практикуйтесь в удобном для вас темпе
        </Text>
      </Space>

      <Pagination
        current={currentPage}
        pageSize={pageSize}
        total={total}
        onChange={onChange}
        disabled={loading}
        showSizeChanger={false}
      />
    </div>
  );
};
