import { Empty, Result } from 'antd';
import { useEffect, useState } from 'react';
import OfferCard from '../components/OfferCard';
import { UserRole } from '../constants/enums';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';

export default function OffersPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === UserRole.HIRING_MANAGER || user?.role === UserRole.ADMIN;
  const [offers, setOffers] = useState<Offer[]>([]);

  const load = async () => {
    const { data } = await api.get('/offers/pending');
    setOffers(data);
  };

  useEffect(() => {
    if (isManager) load();
  }, [isManager]);

  if (!isManager) {
    return <Result status={403} title="无访问权限" subTitle="只有招聘经理可以处理 Offer 审批。" />;
  }

  return (
    <>
      <div>
        <h1 className="page-title">Offer 审批</h1>
        <p className="subtle">仅展示分配给我、等待审批的 Offer。拒绝时需要写明原因。</p>
      </div>
      {offers.length === 0 ? (
        <Empty description="暂无待你处理的 Offer" />
      ) : (
        offers.map((o) => <OfferCard key={o.id} offer={o} showCandidate onChanged={load} />)
      )}
    </>
  );
}
