import axios from 'axios';
import type { CentralBank, EconomicEvent, PairDetail, PairSignal, RateHistoryRow } from '@/types';

const api = axios.create({ baseURL: '/api' });

export const fetchCentralBanks = () => api.get<CentralBank[]>('/central-banks').then((r) => r.data);

export const updateCentralBank = (id: string, patch: Partial<CentralBank>) =>
  api.put<CentralBank>(`/central-banks/${id}`, patch).then((r) => r.data);

export const updateAllCentralBanks = (banks: (Partial<CentralBank> & { id: string })[]) =>
  api.post<CentralBank[]>('/central-banks/update-all', { banks }).then((r) => r.data);

export const fetchRateHistory = (currency: string) =>
  api.get<RateHistoryRow[]>(`/rate-history/${currency}`).then((r) => r.data);

export const fetchPairs = () => api.get<PairSignal[]>('/pairs').then((r) => r.data);

export const fetchPairDetail = (pair: string) =>
  api.get<PairDetail>(`/pairs/${pair.replace('/', '-')}`).then((r) => r.data);

export const updatePairSignal = (pair: string, patch: { expected_change?: string; notes?: string }) =>
  api.put<PairSignal>(`/pairs/${pair.replace('/', '-')}`, patch).then((r) => r.data);

export const fetchEconomicEvents = () => api.get<EconomicEvent[]>('/economic-events').then((r) => r.data);

export const updateEconomicEvent = (id: number, expected_decision: string) =>
  api.put<EconomicEvent>(`/economic-events/${id}`, { expected_decision }).then((r) => r.data);
