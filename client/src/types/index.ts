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
  id: number;
  currency: string;
  rate: number;
  effective_date: string;
  change_amount: number;
}

export interface PairSignal {
  id: number;
  pair: string;
  bias: Bias;
  score: number;
  differential: number;
  trend_direction: TrendDirection;
  expected_change: string;
  notes: string;
  updated_at: string;
}

export interface EconomicEvent {
  id: number;
  date: string;
  bank: string;
  expected_decision: string;
  importance: 'HIGH' | 'MEDIUM';
  affected_pairs: string;
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

export const MY_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'];
