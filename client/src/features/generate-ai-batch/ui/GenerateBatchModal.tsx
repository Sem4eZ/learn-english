import React, { useState } from 'react';
import { Modal, Form, Input, Select, Slider, message } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import { CEFR_LEVELS } from '@/shared/config/constants';
import { Section } from '@/entities/section/model/types';
import { questionApi } from '@/entities/question/api/questionApi';

interface GenerateBatchModalProps {
  visible: boolean;
  sections: Section[];
  initialSectionId?: string;
  initialLevel?: string;
  onClose: () => void;
  onGenerated: () => void;
}

export const GenerateBatchModal: React.FC<GenerateBatchModalProps> = ({
  visible,
  sections,
  initialSectionId,
  initialLevel = 'B1',
  onClose,
  onGenerated,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await questionApi.generateBatch({
        sectionId: values.sectionId,
        level: values.level,
        count: values.count,
        customTopic: values.customTopic,
      });

      message.success(`Успешно добавлено вопросов: ${values.count}! 🎉`);
      onGenerated();
      onClose();
      form.resetFields();
    } catch (err: any) {
      if (err.errorFields) return;
      const raw = err.message || '';
      const clean = (raw.includes('503') || raw.includes('429') || raw.includes('Gemini') || raw.includes('{'))
        ? 'Сервер сейчас обрабатывает много запросов. Пожалуйста, повторите попытку через пару секунд.'
        : raw || 'Ошибка при подготовке вопросов';
      message.error(clean);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <span>
          <PlusCircleOutlined style={{ marginRight: 8, color: '#6366f1' }} />
          Добавление вопросов по теме
        </span>
      }
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText={loading ? 'Подготовка...' : 'Добавить задания'}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          sectionId: initialSectionId || sections[0]?.id || 'grammar',
          level: initialLevel,
          count: 5,
          customTopic: '',
        }}
      >
        <Form.Item
          name="sectionId"
          label="Тематический курс"
          rules={[{ required: true, message: 'Выберите курс' }]}
        >
          <Select options={sections.map(s => ({ value: s.id, label: s.title }))} />
        </Form.Item>

        <Form.Item
          name="level"
          label="Уровень сложности (CEFR)"
          rules={[{ required: true, message: 'Выберите уровень' }]}
        >
          <Select options={CEFR_LEVELS.map(l => ({ value: l.value, label: l.label }))} />
        </Form.Item>

        <Form.Item
          name="customTopic"
          label="Уточняющая тема или ситуация (необязательно)"
          tooltip="Например: 'Условные предложения 3-го типа', 'Собеседование на позицию Senior Frontend', 'В аэропорту при задержке рейса'"
        >
          <Input placeholder="Например: Phrasal verbs with 'turn' and 'get'..." />
        </Form.Item>

        <Form.Item name="count" label="Количество вопросов">
          <Slider min={3} max={10} marks={{ 3: '3', 5: '5', 10: '10' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
