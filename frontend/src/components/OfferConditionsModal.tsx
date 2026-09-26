import { DatePicker, Form, InputNumber, Modal, Switch } from 'antd';
import dayjs from 'dayjs';
import { useOfferStore } from '../stores/offerStore';

// HR 调整薪资 / 入职日期；保存即提交新版本进入待审批
export default function OfferConditionsModal({ offer, open, onClose }: { offer?: Offer; open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const updateOffer = useOfferStore((s) => s.updateOffer);

  const handleOk = async () => {
    const values = await form.validateFields();
    await updateOffer(offer!.id, {
      salary: values.salary,
      startDate: values.startDate.format('YYYY-MM-DD'),
      submit: values.submit,
    });
    onClose();
  };

  return (
    <Modal
      title={`调整 Offer 条件 #${offer?.id ?? ''}`}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存并提交审批"
      cancelText="取消"
      destroyOnClose
    >
      <p className="subtle">
        审批通过后调整条件，Offer 将回到待审批，原审批不再可用于发送；已发送的 Offer 不能编辑。
      </p>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          salary: offer ? Number(offer.salary) : undefined,
          startDate: offer ? dayjs(offer.startDate) : undefined,
          submit: true,
        }}
      >
        <Form.Item name="salary" label="月薪（元）" rules={[{ required: true, message: '请填写薪资' }]}>
          <InputNumber min={0} step={1000} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
        </Form.Item>
        <Form.Item name="startDate" label="入职日期" rules={[{ required: true, message: '请选择入职日期' }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="submit" label="保存后提交审批" valuePropName="checked">
          <Switch checkedChildren="提交" unCheckedChildren="仅保存" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
