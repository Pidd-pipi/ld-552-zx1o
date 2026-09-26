import { Button, Card, Descriptions, Empty, List, Space, Tabs, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import InterviewTimeline from '../components/InterviewTimeline';
import { OfferApprovalRecords, OfferConditions, OfferStatusTag } from '../components/OfferShared';
import OfferReviewModal from '../components/OfferReviewModal';
import OfferConditionsModal from '../components/OfferConditionsModal';
import CreateOfferModal from '../components/CreateOfferModal';
import { OfferStatus, UserRole, statusText } from '../constants/enums';
import { useAuthStore } from '../stores/authStore';
import { OFFERS_CHANGED_EVENT, useOfferStore } from '../stores/offerStore';
import { api } from '../utils/api';

export default function CandidateDetailPage() {
  const { id } = useParams();
  const candidateId = Number(id);
  const can = useAuthStore((s) => s.can);
  const isManager = can([UserRole.HIRING_MANAGER]);
  const { submitOffer, sendOffer, changeStatus } = useOfferStore();
  const [candidate, setCandidate] = useState<Candidate>();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<Offer>();
  const [editing, setEditing] = useState<Offer>();

  const reload = () => {
    Promise.all([
      api.get(`/candidates/${id}`),
      api.get(`/candidates/${id}/interviews`),
      api.get(`/audit-logs/candidate/${id}`).catch(() => ({ data: [] })),
    ]).then(([c, i, a]) => { setCandidate(c.data); setInterviews(i.data); setAudits(a.data); });
  };
  useEffect(reload, [id]);
  useEffect(() => {
    window.addEventListener(OFFERS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(OFFERS_CHANGED_EVENT, reload);
  }, [id]);

  const offerChanges = (offerId: number) => audits.filter((a) => a.entity === 'Offer' && a.entityId === offerId);

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
                      <List.Item.Meta title={r.job?.title} description={<><Tag>{statusText[r.status]}</Tag>{r.resumeUrl}</>} />
                    </List.Item>
                  )}
                />
              ),
            },
            { key: 'timeline', label: 'InterviewTimeline 面试时间线', children: <InterviewTimeline interviews={interviews} /> },
            {
              key: 'offers',
              label: 'Offer 状态',
              children: (
                <>
                  {!isManager && (
                    <div style={{ marginBottom: 14 }}>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>创建 Offer</Button>
                    </div>
                  )}
                  <List
                    dataSource={candidate?.offers || []}
                    locale={{ emptyText: <Empty description="暂无 Offer，HR 可在此创建" /> }}
                    renderItem={(o) => (
                      <Card className="tf-card" size="small" style={{ marginBottom: 14 }}
                        title={<Space><span>{o.job?.title}</span><OfferStatusTag status={o.status} /></Space>}
                        extra={<span className="subtle">更新于 {dayjs(o.updatedAt).format('YYYY-MM-DD HH:mm')}</span>}
                      >
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <OfferConditions offer={o} />
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>审批记录</div>
                            <OfferApprovalRecords offer={o} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>状态变化</div>
                            {offerChanges(o.id).length === 0 ? <span className="subtle">暂无状态变化记录</span> : (
                              <List
                                size="small"
                                dataSource={offerChanges(o.id)}
                                renderItem={(a) => (
                                  <List.Item>
                                    <Space size={6} wrap>
                                      <Tag>{a.beforeStatus || '—'}</Tag>→<Tag color="blue">{a.afterStatus}</Tag>
                                      <span className="subtle">{a.actor?.name || '系统'} · {dayjs(a.createdAt).format('YYYY-MM-DD HH:mm')}{a.reason ? ` · ${a.reason}` : ''}</span>
                                    </Space>
                                  </List.Item>
                                )}
                              />
                            )}
                          </div>
                          <Space wrap>
                            {isManager
                              ? (o.status === OfferStatus.PENDING_APPROVAL && <Button type="primary" size="small" onClick={() => setReviewing(o)}>审批</Button>)
                              : (
                                <>
                                  {o.status === OfferStatus.DRAFT && <Button size="small" onClick={() => submitOffer(o.id)}>提交审批</Button>}
                                  {[OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED, OfferStatus.REJECTED].includes(o.status) && !o.sentAt && (
                                    <Button size="small" onClick={() => setEditing(o)}>调整条件</Button>
                                  )}
                                  {o.status === OfferStatus.REJECTED && !o.sentAt && (
                                    <Button size="small" type="primary" ghost onClick={() => submitOffer(o.id)}>重新提交</Button>
                                  )}
                                  {o.status === OfferStatus.APPROVED && (o.approvedVersion === o.version
                                    ? <Button size="small" type="primary" onClick={() => sendOffer(o.id)}>发送录用通知</Button>
                                    : <Tag color="red">审批对应旧版本，不能发送</Tag>)}
                                  {o.status === OfferStatus.SENT && (
                                    <>
                                      <Button size="small" onClick={() => changeStatus(o.id, OfferStatus.ACCEPTED)}>候选人接受</Button>
                                      <Button size="small" danger onClick={() => changeStatus(o.id, OfferStatus.REJECTED, '候选人拒绝')}>候选人拒绝</Button>
                                      <Button size="small" onClick={() => changeStatus(o.id, OfferStatus.WITHDRAWN)}>撤回</Button>
                                    </>
                                  )}
                                  {o.sentAt && [OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.REJECTED, OfferStatus.WITHDRAWN].includes(o.status) && (
                                    <span className="subtle">已发送，条件不可再编辑</span>
                                  )}
                                </>
                              )}
                          </Space>
                        </Space>
                      </Card>
                    )}
                  />
                </>
              ),
            },
            {
              key: 'audit',
              label: '状态流转审计',
              children: (
                <List
                  dataSource={audits}
                  renderItem={(a) => (
                    <List.Item>{a.entity} #{a.entityId}: {a.beforeStatus} → {a.afterStatus} · {a.actor?.name || '系统'} · {a.reason}</List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </div>
      <CreateOfferModal candidateId={candidateId} open={creating} onClose={() => setCreating(false)} onCreated={reload} />
      <OfferReviewModal offer={reviewing} open={Boolean(reviewing)} onClose={() => { setReviewing(undefined); reload(); }} />
      <OfferConditionsModal offer={editing} open={Boolean(editing)} onClose={() => { setEditing(undefined); reload(); }} />
    </>
  );
}
