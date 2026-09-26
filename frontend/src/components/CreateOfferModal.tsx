import { DatePicker, Form, InputNumber, Modal, Select, Switch } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { api } from '../utils/api';
import { useOfferStore } from '../stores/offerStore';

// 在候选人详情中创建 Offer：选择职位、薪资、入职日期，可直接提交审批
export default function CreateOfferModal({ candidateId, open, onClose, onCreated }: { candidateId: number; open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form] = Form.useForm();
  const [jobs, setJobs] = useState<Job[]>([]);
  const createOffer = useOfferStore((s) => s.createOffer);

  useEffect(() => {
    if (open) api.get('/jobs').then(({ data }) => setJobs(data));
  }, [open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await createOffer({
      candidateId,
      jobId: values.jobId,
      salary: values.salary,
      startDate: values.startDate.format('YYYY-MM-DD'),
      submit: values.submit,
    });
    form.resetFields();
    onClose();
    onCreated();
  };

  return (
    <Modal title="创建 Offer" open={open} onOk={handleOk} onCancel={() => { form.resetFields(); onClose(); }} okText="保存" destroyOnClose>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          submit: true,
          startDate: dayjs().add(30, 'day'),
          jobId: jobs[0]?.id,
        }}
      >
        <Form.Item name="jobId" label="职位" rules={[{ required: true, message: '请选择职位' }]}>
          <Select
            placeholder="选择投递职位"
            options={jobs.map((j) => ({ value: j.id, label: `${j.title}（${j.department} · 招聘经理 ID ${j.hiringManagerId}）` }))}
          />
        </Form.Item>
        <Form.Item name="salary" label="月薪（元）" rules={[{ required: true, message: '请填写薪资' }]}>
          <InputNumber min={0} step={1000} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="startDate" label="入职日期" rules={[{ required: true, message: '请选择入职日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="submit" label="创建后直接提交审批" valuePropName="checked">
          <Switch checkedChildren="提交审批" unCheckedChildren="仅存草稿" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
