import { create } from 'zustand';
import { message } from 'antd';
import { OfferStatus } from '../constants/enums';
import { api } from '../utils/api';

// Offer 写操作后广播，供候选人详情等页面刷新数据
export const OFFERS_CHANGED_EVENT = 'offers:changed';
export function notifyOffersChanged() { window.dispatchEvent(new Event(OFFERS_CHANGED_EVENT)); }

type OfferFilters = { status?: OfferStatus; candidateId?: number };
type ReviewPayload = { decision: 'APPROVED' | 'REJECTED'; reason?: string };
type ConditionPayload = { salary?: number; startDate?: string; submit?: boolean };

type OfferState = {
  offers: Offer[];
  loading: boolean;
  loadOffers: (filters?: OfferFilters) => Promise<void>;
  createOffer: (payload: { candidateId: number; jobId: number; salary: number; startDate: string; submit?: boolean }) => Promise<void>;
  updateOffer: (id: number, payload: ConditionPayload) => Promise<void>;
  submitOffer: (id: number) => Promise<void>;
  reviewOffer: (id: number, payload: ReviewPayload) => Promise<void>;
  sendOffer: (id: number) => Promise<void>;
  changeStatus: (id: number, status: OfferStatus, reason?: string) => Promise<void>;
};

export const useOfferStore = create<OfferState>((set, get) => ({
  offers: [],
  loading: false,
  async loadOffers(filters) {
    set({ loading: true });
    try {
      const { data } = await api.get('/offers', { params: filters });
      set({ offers: data });
    } finally {
      set({ loading: false });
    }
  },
  async createOffer(payload) {
    await api.post('/offers', payload);
    message.success(payload.submit ? 'Offer 已提交审批' : 'Offer 草稿已创建');
    notifyOffersChanged();
  },
  async updateOffer(id, payload) {
    await api.patch(`/offers/${id}`, payload);
    message.success(payload.submit ? '条件已更新并重新提交审批' : 'Offer 条件已保存');
    notifyOffersChanged();
    await get().loadOffers();
  },
  async submitOffer(id) {
    await api.post(`/offers/${id}/submit`);
    message.success('已提交审批');
    notifyOffersChanged();
    await get().loadOffers();
  },
  async reviewOffer(id, payload) {
    await api.post(`/offers/${id}/review`, payload);
    message.success(payload.decision === 'APPROVED' ? '已审批通过' : '已拒绝');
    notifyOffersChanged();
    await get().loadOffers();
  },
  async sendOffer(id) {
    await api.post(`/offers/${id}/send`);
    message.success('录用通知已发送');
    notifyOffersChanged();
    await get().loadOffers();
  },
  async changeStatus(id, status, reason) {
    await api.patch(`/offers/${id}/status`, { status, reason });
    message.success('Offer 状态已更新');
    notifyOffersChanged();
    await get().loadOffers();
  },
}));
