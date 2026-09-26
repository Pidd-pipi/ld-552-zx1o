import { Tag } from 'antd';
import dayjs from 'dayjs';
import { OfferApprovalDecision, OfferStatus, offerDecisionColor, offerStatusColor, statusText } from '../constants/enums';

const decisionText: Record<string, string> = {
  [OfferApprovalDecision.SUBMITTED]: '提交审批',
  [OfferApprovalDecision.APPROVED]: '审批通过',
  [OfferApprovalDecision.REJECTED]: '审批拒绝',
};

export function OfferStatusTag({ status }: { status: OfferStatus | string }) {
  return <Tag color={offerStatusColor[status] || 'default'}>{statusText[status] || status}</Tag>;
}

export function OfferConditions({ offer }: { offer: Offer }) {
  const stale = offer.status === OfferStatus.APPROVED && offer.approvedVersion !== offer.version;
  const reApproving = offer.status === OfferStatus.PENDING_APPROVAL && offer.version > 1;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Tag>当前版本 v{offer.version}</Tag>
      <Tag color="gold">薪资 ¥{Number(offer.salary).toLocaleString()}</Tag>
      <Tag color="geekblue">入职 {dayjs(offer.startDate).format('YYYY-MM-DD')}</Tag>
      {stale && <Tag color="red">审批对应旧版本，需重新审批</Tag>}
      {reApproving && <Tag color="orange">条件已调整，v{offer.version - 1} 审批失效，等待重新审批</Tag>}
    </div>
  );
}

// 审批记录时间线：按版本分组，展示每次提交 / 通过 / 拒绝及原因
export function OfferApprovalRecords({ offer }: { offer: Offer }) {
  const versions = offer.versions || [];
  if (versions.length === 0) return <span className="subtle">暂无审批记录</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {versions.map((v) => (
        <div key={v.id} style={{ border: '1px solid #e5e0d3', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            v{v.version} · ¥{Number(v.salary).toLocaleString()} · 入职 {dayjs(v.startDate).format('YYYY-MM-DD')}
            {v.version === offer.version ? <Tag color="green" style={{ marginLeft: 8 }}>当前版本</Tag> : <Tag style={{ marginLeft: 8 }}>历史版本</Tag>}
          </div>
          {(v.approvals || []).length === 0 ? (
            <div className="subtle" style={{ fontSize: 12 }}>草稿快照，尚未提交</div>
          ) : (
            (v.approvals || []).map((a) => (
              <div key={a.id} style={{ fontSize: 13, color: '#3f4742', marginBottom: 2 }}>
                <Tag color={offerDecisionColor[a.decision]} style={{ marginInlineEnd: 6 }}>{decisionText[a.decision] || a.decision}</Tag>
                {a.actor?.name || '系统'} · {dayjs(a.createdAt).format('YYYY-MM-DD HH:mm')}
                {a.reason ? <span style={{ marginLeft: 8 }}>原因：{a.reason}</span> : null}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

export { decisionText as offerDecisionText };
