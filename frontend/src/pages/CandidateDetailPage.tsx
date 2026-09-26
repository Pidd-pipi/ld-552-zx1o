import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, DatePicker, Descriptions, Empty, Form, InputNumber, List, Modal, Select, Tabs, Tag, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import InterviewTimeline from '../components/InterviewTimeline';
import OfferCard from '../components/OfferCard';
import { statusText } from '../constants/enums';
import { api } from '../utils/api';

export default function CandidateDetailPage() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState<Candidate>();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    const [c, i, o, a] = await Promise.all([
      api.get(`/candidates/${id}`),
      api.get(`/candidates/${id}/interviews`),
      api.get(`/candidates/${id}/offers`),
      api.get(`/audit-logs/candidate/${id}`, { skipErrorMessage: true } as any).catch(() => ({ data: [] })),
    ]);
    setCandidate(c.data);
    setInterviews(i.data);
    setOffers(o.data);
    setAudits(a.data);
  };

  useEffect(() => { load(); }, [id]);

  /** 创建 Offer：默认保存为草稿（DRAFT），HR 再提交审批；也可直接提交进入待审批 */
  const createOffer = async (submit: boolean) => {
    const v = await form.validateFields();
    await api.post('/offers', {
      candidateId: Number(id),
      jobId: Number(v.jobId),
      salary: Number(v.salary),
      startDate: v.startDate.format('YYYY-MM-DD'),
    });
    if (submit) {
      const { data: created } = await api.get(`/candidates/${id}/offers`);
      const latest: Offer = created[0];
      if (latest) await api.post(`/offers/${latest.id}/submit`);
    }
    message.success(submit ? 'Offer 已创建并提交审批' : 'Offer 草稿已创建');
    setCreateOpen(false);
    form.resetFields();
    load();
  };

  // 创建表单中的职位候选：候选人投递过的职位
  const jobOptions = (candidate?.resumes ?? [])
    .map((r) => r.job)
    .filter((j): j is Job => Boolean(j))
    .filter((j, idx, arr) => arr.findIndex((x) => x.id === j.id) === idx)
    .map((j) => ({ value: j.id, label: `${j.title}（${j.department}）` }));

  return (
    <>
      <h1 className="page-title">{candidate?.name}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, marginTop: 18 }}>
        <Card className="tf-card">
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: 'email', label: '邮箱', children: candidate?.email },
              { key: 'phone', label: '手机', children: candidate?.phone },
              { key: 'source', label: '来源', children: candidate?.source },
            ]}
          />
        </Card>
        <Tabs
          items={[
            {
              key: 'resumes',
              label: '投递记录',
              children: (
                <List
                  dataSource={candidate?.resumes || []}
                  renderItem={(r) => (
                    <List.Item>
                      <List.Item.Meta
                        title={r.job?.title}
                        description={<><Tag>{statusText[r.status]}</Tag>{r.resumeUrl}</>}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            { key: 'timeline', label: 'InterviewTimeline 面试时间线', children: <InterviewTimeline interviews={interviews} /> },
            {
              key: 'offers',
              label: 'Offer 审批',
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                      创建 Offer
                    </Button>
                  </div>
                  {offers.length === 0 ? (
                    <Empty description="暂无 Offer" />
                  ) : (
                    offers.map((o) => <OfferCard key={o.id} offer={o} onChanged={load} />)
                  )}
                </div>
              ),
            },
            {
              key: 'audit',
              label: '状态流转审计',
              children: (
                <List
                  dataSource={audits}
                  renderItem={(a) => (
                    <List.Item>
                      {a.entity} #{a.entityId}: {a.beforeStatus} → {a.afterStatus} · {a.actor?.name || '系统'} ·{' '}
                      {new Date(a.createdAt).toLocaleString()}
                      {a.reason ? ` · 原因：${a.reason}` : ''}
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="创建 Offer"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        destroyOnClose
        footer={[
          <Button key="draft" onClick={() => createOffer(false)}>保存草稿</Button>,
          <Button key="submit" type="primary" onClick={() => createOffer(true)}>创建并提交审批</Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ jobId: jobOptions[0]?.value, startDate: dayjs().add(30, 'day') }}
        >
          <Form.Item name="jobId" label="关联职位" rules={[{ required: true, message: '请选择职位' }]}>
            <Select options={jobOptions} placeholder="选择候选人投递的职位" />
          </Form.Item>
          <Form.Item name="salary" label="薪资（元/月）" rules={[{ required: true, message: '请输入薪资' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={0} />
          </Form.Item>
          <Form.Item name="startDate" label="入职日期" rules={[{ required: true, message: '请选择入职日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
