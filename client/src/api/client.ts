import axios from 'axios';
import type { AiRatesResponse, FxHistoryResponse, FxLatestResponse, LiveRatesResponse, NewsEvent } from '@/types';

const api = axios.create({ baseURL: '/api' });

// Live economic news/calendar, proxied server-side from the free ForexFactory
// JSON feed (avoids CORS + keeps their rate limit to one call per cache window).
export const fetchNewsCalendar = () => api.get<NewsEvent[]>('/news-calendar').then((r) => r.data);

// Live historical FX rates, proxied server-side from the free Frankfurter API.
export const fetchFxHistory = (params: { base: string; symbols: string[]; start: string; end: string }) =>
  api
    .get<FxHistoryResponse>('/fx-history', {
      params: { base: params.base, symbols: params.symbols.join(','), start: params.start, end: params.end },
    })
    .then((r) => r.data);

// Live current FX spot rates, proxied server-side from the free Frankfurter API.
export const fetchFxLatest = (params: { base: string; symbols?: string[] }) =>
  api
    .get<FxLatestResponse>('/fx-latest', { params: { base: params.base, symbols: params.symbols?.join(',') } })
    .then((r) => r.data);

// Live official policy rates for the banks that have a free no-key API
// (Bank of Canada, ECB, SNB). Per-bank null means that fetch failed upstream.
export const fetchLiveRates = () => api.get<LiveRatesResponse>('/live-rates').then((r) => r.data);

// AI-researched policy rates (Claude + web search) for the 5 banks with no
// free official API. `enabled: false` means no server-side API key is
// configured — every bank is null and this is a no-op.
export const fetchAiRates = () => api.get<AiRatesResponse>('/ai-rates').then((r) => r.data);
