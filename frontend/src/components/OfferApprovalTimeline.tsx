import { Tag, Timeline, Typography } from 'antd';
import { offerDecisionColor, offerDecisionText } from '../constants/enums';

const { Text } = Typography;

/** 展示一个 Offer 各版本的提交 / 通过 / 拒绝记录，旧版本记录会标注"已失效" */
export default function OfferApprovalTimeline({ offer }: { offer: Offer }) {
  const approvals = offer.approvals ?? [];
  if (approvals.length === 0) {
    return <Text type="secondary">暂无审批记录，提交审批后可在此查看。</Text>;
  }
  const isStaleApproval = (a: OfferApproval) =>
    a.decision === 'APPROVED' && a.version !== offer.version;
  return (
    <Timeline
      items={approvals.map((a) => ({
        color: offerDecisionColor[a.decision],
        children: (
          <div>
            <Tag color={offerDecisionColor[a.decision]}>{offerDecisionText[a.decision]}</Tag>
            <Text strong>v{a.version}</Text>
            {isStaleApproval(a) && <Tag color="warning">旧审批已失效</Tag>}
            <div className="subtle">
              薪资 {a.salary} · 入职 {new Date(a.startDate).toLocaleDateString()}
            </div>
            <div className="subtle">
              {a.actor?.name || '系统'} · {new Date(a.createdAt).toLocaleString()}
            </div>
            {a.reason && <div>原因：{a.reason}</div>}
          </div>
        ),
      }))}
    />
  );
}
