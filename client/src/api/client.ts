import axios from 'axios';
import type { FxHistoryResponse, NewsEvent } from '@/types';

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
