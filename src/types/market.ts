export interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency?: string;
  suffix?: string; // e.g. "%" for yields
  error?: boolean;
}

export interface MarketSection {
  id: string;
  title: string;
  emoji: string;
  items: MarketItem[];
}
