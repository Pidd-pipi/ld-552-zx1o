import { Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Space, Tag, message } from 'antd';
import { useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { OfferStatus, UserRole, offerStatusColor, statusText } from '../constants/enums';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import OfferApprovalTimeline from './OfferApprovalTimeline';

type Props = {
  offer: Offer;
  /** 经理工作台场景下显示候选人姓名 */
  showCandidate?: boolean;
  onChanged: () => void;
};

/** 已发送（含发送后拒绝/撤回/接受）的 Offer 为只读，不能再编辑条件 */
function isLocked(o: Offer) {
  return Boolean(o.sentAt) || [OfferStatus.SENT, OfferStatus.ACCEPTED, OfferStatus.WITHDRAWN].includes(o.status);
}

/** 当前展示的条件是否已通过审批（approvedVersion 指向当前 version 才有效） */
function isCurrentVersionApproved(o: Offer) {
  return o.status === OfferStatus.APPROVED && o.approvedVersion === o.version;
}

export default function OfferCard({ offer, showCandidate, onChanged }: Props) {
  const can = useAuthStore((s) => s.can);
  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<{ label: string; status: OfferStatus } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [form] = Form.useForm<{ salary: number; startDate: Dayjs }>();
  const [rejectForm] = Form.useForm<{ reason: string }>();

  const isHr = can([UserRole.HR, UserRole.ADMIN]);
  const isManager = can([UserRole.HIRING_MANAGER, UserRole.ADMIN]);
  const locked = isLocked(offer);
  const pending = offer.status === OfferStatus.PENDING_APPROVAL;

  const call = async (label: string, run: () => Promise<unknown>) => {
    try {
      await run();
      message.success(label);
      onChanged();
    } catch {
      /* 统一错误提示已由拦截器处理 */
    }
  };

  /** 简单状态动作：发送 / 接受 */
  const simpleAction = (label: string, url: string) => call(label, () => api.post(url));

  /** 发送后的候选人侧流转（拒绝/撤回），需要写明原因 */
  const openReason = (label: string, status: OfferStatus) => {
    setReasonText('');
    setReasonOpen({ label, status });
  };

  const confirmReason = async () => {
    if (!reasonText.trim()) {
      message.error('请填写原因');
      return;
    }
    try {
      await api.patch(`/offers/${offer.id}/status`, { status: reasonOpen!.status, reason: reasonText.trim() });
      message.success('操作成功');
      setReasonOpen(null);
      onChanged();
    } catch {
      /* 拦截器统一提示 */
    }
  };

  const submitEdit = async () => {
    const v = await form.validateFields();
    const payload: { salary?: number; startDate?: string } = {
      salary: Number(v.salary),
      startDate: v.startDate.format('YYYY-MM-DD'),
    };
    try {
      // 条件改动后后端自动版本升级并重新进入待审批，旧审批失效
      await api.patch(`/offers/${offer.id}/conditions`, payload);
      message.success('条件已调整，Offer 重新进入待审批');
      setEditOpen(false);
      onChanged();
    } catch {
      /* 拦截器统一提示 */
    }
  };

  const submitReject = async () => {
    const v = await rejectForm.validateFields();
    try {
      await api.post(`/offers/${offer.id}/reject`, { reason: v.reason });
      message.success('已拒绝并写明原因');
      setRejectOpen(false);
      onChanged();
    } catch {
      /* 拦截器统一提示 */
    }
  };

  const title = (
    <Space wrap>
      {showCandidate && offer.candidate ? <span>{offer.candidate.name} · </span> : null}
      {offer.job?.title ?? `职位 #${offer.jobId}`}
      <Tag color={offerStatusColor[offer.status]}>{statusText[offer.status]}</Tag>
      <Tag>v{offer.version}</Tag>
      {offer.approvedVersion && (
        <Tag color={offer.approvedVersion === offer.version ? 'success' : 'warning'}>
          审批版本 v{offer.approvedVersion}
          {offer.approvedVersion !== offer.version ? '（已过期）' : ''}
        </Tag>
      )}
    </Space>
  );

  return (
    <Card size="small" title={title} style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        薪资 <strong>{offer.salary}</strong> · 入职日期{' '}
        <strong>{new Date(offer.startDate).toLocaleDateString()}</strong>
      </div>
      <div className="subtle" style={{ marginBottom: 8 }}>
        审批经理：{offer.assignedApprover?.name || '—'}
        {offer.approver ? ` · 上次审批人：${offer.approver.name}` : ''}
        {offer.sentAt ? ` · 发送时间：${new Date(offer.sentAt).toLocaleString()}` : ''}
      </div>

      <Space wrap style={{ marginBottom: 12 }}>
        {/* HR 操作 */}
        {isHr && offer.status === OfferStatus.DRAFT && (
          <Button type="primary" onClick={() => call('已提交审批', () => api.post(`/offers/${offer.id}/submit`))}>
            提交审批
          </Button>
        )}
        {isHr && offer.status === OfferStatus.REJECTED && !locked && (
          <Button onClick={() => call('已重新提交审批', () => api.post(`/offers/${offer.id}/submit`))}>
            重新提交审批
          </Button>
        )}
        {isHr && isCurrentVersionApproved(offer) && (
          <Popconfirm title="确认向候选人发送该录用通知？" onConfirm={() => simpleAction('录用通知已发送', `/offers/${offer.id}/send`)}>
            <Button type="primary">发送 Offer</Button>
          </Popconfirm>
        )}
        {isHr && offer.status === OfferStatus.APPROVED && !isCurrentVersionApproved(offer) && (
          <Tag color="warning">审批已失效，请重新调整并提交</Tag>
        )}
        {isHr && !pending && !locked && (
          <Button onClick={() => { form.setFieldsValue({ salary: Number(offer.salary), startDate: dayjs(offer.startDate) }); setEditOpen(true); }}>
            调整条件
          </Button>
        )}
        {isHr && offer.status === OfferStatus.SENT && (
          <>
            <Button onClick={() => call('已记录候选人接受', () => api.patch(`/offers/${offer.id}/status`, { status: OfferStatus.ACCEPTED }))}>
              标记已接受
            </Button>
            <Button danger onClick={() => openReason('候选人拒绝 Offer', OfferStatus.REJECTED)}>
              候选人拒绝
            </Button>
            <Button onClick={() => openReason('撤回 Offer', OfferStatus.WITHDRAWN)}>
              撤回
            </Button>
          </>
        )}

        {/* 招聘经理操作：只能处理分配给自己的 Offer（后端强制校验） */}
        {isManager && pending && (
          <>
            <Button
              type="primary"
              onClick={() => call('已审批通过', () => api.post(`/offers/${offer.id}/approve`))}
            >
              审批通过
            </Button>
            <Button danger onClick={() => { rejectForm.resetFields(); setRejectOpen(true); }}>
              拒绝
            </Button>
          </>
        )}
        {locked && <Tag>录用通知已发送，条件不可再编辑</Tag>}
      </Space>

      <OfferApprovalTimeline offer={offer} />

      {/* 调整薪资 / 入职日期：保存后自动重新提交新版本审批 */}
      <Modal
        title={`调整 Offer 条件（v${offer.version} → v${offer.version + 1}）`}
        open={editOpen}
        onOk={submitEdit}
        onCancel={() => setEditOpen(false)}
        okText="保存并重新提交审批"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="salary" label="薪资" rules={[{ required: true, message: '请输入薪资' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={0} addonAfter="元/月" />
          </Form.Item>
          <Form.Item name="startDate" label="入职日期" rules={[{ required: true, message: '请选择入职日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 经理拒绝：原因必填 */}
      <Modal
        title="拒绝 Offer 审批"
        open={rejectOpen}
        onOk={submitReject}
        onCancel={() => setRejectOpen(false)}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="reason" label="拒绝原因" rules={[{ required: true, whitespace: true, message: '拒绝时必须填写原因' }]}>
            <Input.TextArea rows={3} placeholder="请写明拒绝原因，HR 调整后可重新提交" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 发送后流转（候选人拒绝 / 撤回）：原因必填 */}
      <Modal
        title={reasonOpen?.label}
        open={!!reasonOpen}
        onOk={confirmReason}
        onCancel={() => setReasonOpen(null)}
        okText="确认"
        destroyOnClose
      >
        <Input.TextArea
          rows={3}
          autoFocus
          value={reasonText}
          onChange={(e) => setReasonText(e.target.value)}
          placeholder="请填写原因"
        />
      </Modal>
    </Card>
  );
}
