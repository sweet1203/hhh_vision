export interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency?: string;
  suffix?: string; // e.g. "%" for yields
  label?: string;      // 뱃지 텍스트 override (e.g. "탐욕", "공포")
  marketState?: string; // 'REGULAR' | 'PRE' | 'POST' | 'POSTPOST' | 'CLOSED'
  error?: boolean;
}

export interface MarketSection {
  id: string;
  title: string;
  emoji: string;
  items: MarketItem[];
}
