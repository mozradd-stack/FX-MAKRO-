export type ForwardGuidance = 'hawkish' | 'neutral' | 'dovish';
export type TrendDirection = 'growing' | 'stable' | 'shrinking';
export type Bias = 'STRONG BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG BEARISH';
export type CombinedSignal = 'STRONG LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG SHORT';

export interface CentralBank {
  id: string;
  name: string;
  country: string;
  currency: string;
  current_rate: number;
  last_change_date: string;
  last_change_amount: number;
  next_meeting: string;
  forward_guidance: ForwardGuidance;
  cpi: number;
  unemployment: number;
  gdp_growth: number;
  updated_at: string;
}

export interface RateHistoryRow {
  effective_date: string;
  rate: number;
  change_amount: number;
}

export interface PairSignal {
  pair: string;
  bias: Bias;
  score: number;
  differential: number;
  trend_direction: TrendDirection;
  expected_change: string;
  notes: string;
}

export interface PairDetail {
  signal: PairSignal;
  bankA: CentralBank;
  bankB: CentralBank;
  differentialHistory: { date: string; differential: number }[];
  combined: {
    technical: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
    fundamental: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
    signal: CombinedSignal;
    reasoning: string;
  };
}

// Derived from each bank's next_meeting date — no separate DB entity needed.
export interface CentralBankMeeting {
  bankId: string;
  bank: string;
  currency: string;
  date: string;
  forward_guidance: ForwardGuidance;
  importance: 'HIGH' | 'MEDIUM';
  affected_pairs: string[];
}

// Live feed from the ForexFactory calendar proxy (/api/news-calendar).
export interface NewsEvent {
  title: string;
  country: string;
  date: string; // ISO timestamp
  impact: 'High' | 'Medium' | 'Low' | 'Holiday' | string;
  forecast: string;
  previous: string;
  actual: string;
}

// Live proxy response from /api/fx-history (Frankfurter): date -> currency -> rate vs. base.
export interface FxHistoryResponse {
  base: string;
  start: string;
  end: string;
  rates: Record<string, Record<string, number>>;
}

export const MY_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];
