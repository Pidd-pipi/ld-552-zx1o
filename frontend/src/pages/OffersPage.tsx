import { Button, Card, Select, Space, Table, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { OfferStatus, UserRole, statusText } from '../constants/enums';
import { useAuthStore } from '../stores/authStore';
import { useOfferStore } from '../stores/offerStore';
import { OfferApprovalRecords, OfferConditions, OfferStatusTag } from '../components/OfferShared';
import OfferReviewModal from '../components/OfferReviewModal';
import OfferConditionsModal from '../components/OfferConditionsModal';
import dayjs from 'dayjs';

export default function OffersPage() {
  const can = useAuthStore((s) => s.can);
  const role = useAuthStore((s) => s.user?.role);
  const { offers, loading, loadOffers, submitOffer, sendOffer, changeStatus } = useOfferStore();
  const [statusFilter, setStatusFilter] = useState<OfferStatus | undefined>();
  const [reviewing, setReviewing] = useState<Offer>();
  const [editing, setEditing] = useState<Offer>();

  const isManager = can([UserRole.HIRING_MANAGER]);

  useEffect(() => {
    loadOffers(statusFilter ? { status: statusFilter } : undefined);
  }, [loadOffers, statusFilter]);

  // 招聘经理默认聚焦待审批队列
  useEffect(() => {
    if (isManager) setStatusFilter(OfferStatus.PENDING_APPROVAL);
  }, [isManager]);

  const columns = useMemo(() => [
    {
      title: '候选人',
      dataIndex: ['candidate', 'name'],
      render: (_: unknown, o: Offer) => <Link to={`/candidates/${o.candidateId}`}>{o.candidate?.name || `#${o.candidateId}`}</Link>,
    },
    { title: '职位', dataIndex: ['job', 'title'], render: (t: string) => t || `#` },
    {
      title: '当前条件',
      render: (_: unknown, o: Offer) => (
        <Space direction="vertical" size={2}>
          <OfferConditions offer={o} />
          <span className="subtle" style={{ fontSize: 12 }}>招聘经理：{o.job?.hiringManager?.name || '-'}</span>
        </Space>
      ),
    },
    { title: '状态', dataIndex: 'status', render: (s: OfferStatus) => <OfferStatusTag status={s} /> },
    {
      title: '最近审批',
      render: (_: unknown, o: Offer) => {
        const latest = o.versions?.[o.versions.length - 1];
        const last = latest?.approvals?.[latest.approvals.length - 1];
        const lastText: Record<string, string> = { SUBMITTED: '已提交', APPROVED: '已通过', REJECTED: '已拒绝' };
        return last ? (
          <Space size={4} direction="vertical">
            <Tag>{lastText[last.decision] || last.decision}{last.reason ? `：${last.reason}` : ''}</Tag>
            <span className="subtle" style={{ fontSize: 12 }}>{dayjs(last.createdAt).format('MM-DD HH:mm')}</span>
          </Space>
        ) : <Tag>草稿</Tag>;
      },
    },
    {
      title: '操作',
      render: (_: unknown, o: Offer) => {
        const editable = [OfferStatus.DRAFT, OfferStatus.PENDING_APPROVAL, OfferStatus.APPROVED, OfferStatus.REJECTED].includes(o.status) && !o.sentAt;
        if (isManager) {
          return o.status === OfferStatus.PENDING_APPROVAL
            ? <Button type="primary" size="small" onClick={() => setReviewing(o)}>审批</Button>
            : <span className="subtle">—</span>;
        }
        // HR / Admin
        return (
          <Space wrap>
            {o.status === OfferStatus.DRAFT && <Button size="small" onClick={() => submitOffer(o.id)}>提交审批</Button>}
            {editable && <Button size="small" onClick={() => setEditing(o)}>调整条件</Button>}
            {o.status === OfferStatus.REJECTED && !o.sentAt && <Button size="small" type="primary" ghost onClick={() => submitOffer(o.id)}>重新提交</Button>}
            {o.status === OfferStatus.APPROVED && (o.approvedVersion === o.version
              ? <Button size="small" type="primary" onClick={() => sendOffer(o.id)}>发送录用通知</Button>
              : <Tag color="red">旧审批不可发送</Tag>)}
            {o.status === OfferStatus.SENT && (
              <>
                <Button size="small" onClick={() => changeStatus(o.id, OfferStatus.ACCEPTED)}>候选人接受</Button>
                <Button size="small" danger onClick={() => changeStatus(o.id, OfferStatus.REJECTED, '候选人拒绝')}>候选人拒绝</Button>
                <Button size="small" onClick={() => changeStatus(o.id, OfferStatus.WITHDRAWN)}>撤回</Button>
              </>
            )}
            {[OfferStatus.ACCEPTED, OfferStatus.WITHDRAWN, OfferStatus.REJECTED].includes(o.status) && o.sentAt && <span className="subtle">已锁定</span>}
          </Space>
        );
      },
    },
  ], [isManager, submitOffer, sendOffer, changeStatus]);

  return (
    <>
      <div>
        <h1 className="page-title">{isManager ? 'Offer 审批' : 'Offer 管理'}</h1>
        <p className="subtle">{isManager ? '仅展示分配给你的职位下的 Offer，拒绝时请写明原因。' : '创建、提交审批、发送录用通知；条件调整后自动回到待审批。'}</p>
      </div>
      <div className="toolbar">
        <Space>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.values(OfferStatus).map((v) => ({ value: v, label: statusText[v] }))}
          />
        </Space>
        <span className="subtle">当前角色：{role}</span>
      </div>
      <Card className="tf-card" styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" loading={loading} dataSource={offers} columns={columns} expandable={{
          expandedRowRender: (o: Offer) => <OfferApprovalRecords offer={o} />,
          rowExpandable: (o: Offer) => Boolean(o.versions?.length),
        }} pagination={{ pageSize: 10 }} />
      </Card>
      <OfferReviewModal offer={reviewing} open={Boolean(reviewing)} onClose={() => setReviewing(undefined)} />
      <OfferConditionsModal offer={editing} open={Boolean(editing)} onClose={() => setEditing(undefined)} />
    </>
  );
}
