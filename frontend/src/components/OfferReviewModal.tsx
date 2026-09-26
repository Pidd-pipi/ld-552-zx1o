import { Form, Input, Modal } from 'antd';
import { useOfferStore } from '../stores/offerStore';

// 招聘经理审批弹窗：通过 / 拒绝；拒绝必须写明原因
export default function OfferReviewModal({ offer, open, onClose }: { offer?: Offer; open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const reviewOffer = useOfferStore((s) => s.reviewOffer);

  const submit = async (decision: 'APPROVED' | 'REJECTED') => {
    const reason = (form.getFieldValue('reason') as string | undefined)?.trim();
    if (decision === 'REJECTED' && !reason) {
      form.setFields([{ name: 'reason', errors: ['拒绝时必须写明原因'] }]);
      return;
    }
    await reviewOffer(offer!.id, { decision, reason: reason || undefined });
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={`审批 Offer #${offer?.id ?? ''}`}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      okText="通过"
      cancelText="拒绝"
      okButtonProps={{ onClick: () => submit('APPROVED') }}
      cancelButtonProps={{ danger: true, onClick: () => submit('REJECTED') }}
      destroyOnClose
    >
      <p className="subtle">
        {offer?.job?.title} · v{offer?.version} · ¥{offer ? Number(offer.salary).toLocaleString() : ''} · {offer?.startDate?.slice(0, 10)}
      </p>
      <Form form={form} layout="vertical">
        <Form.Item name="reason" label="审批意见（拒绝时必填）">
          <Input.TextArea rows={3} placeholder="拒绝时请写明原因，HR 将据此调整条件后重新提交" onChange={() => form.setFields([{ name: 'reason', errors: [] }])} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
