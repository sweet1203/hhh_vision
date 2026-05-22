import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import type { MarketItem } from '@/types/market';

// v3 requires instantiation; disable strict schema validation (Yahoo changes API often)
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  validation: { logErrors: false, logOptionsErrors: false },
});

// Symbol → Korean display name mapping
const SYMBOLS: Record<string, { name: string; suffix?: string }> = {
  // 핵심 지표
  '^KS11':    { name: '코스피' },
  '^KQ11':    { name: '코스닥' },
  'USDKRW=X': { name: '원달러 환율' },
  '^VIX':     { name: 'VIX 공포지수' },
  'BTC-USD':  { name: '비트코인' },
  // 글로벌 지수
  'NQ=F':     { name: '나스닥100 선물' },
  'ES=F':     { name: 'S&P500 선물' },
  'YM=F':     { name: '다우 선물' },
  'RTY=F':    { name: '러셀2000 선물' },
  '^RUT':     { name: '러셀2000' },
  '^SOX':     { name: '필라델피아 반도체' },
  '^N225':    { name: '닛케이225' },
  // 원자재
  'GC=F':     { name: '금 (Gold)' },
  'CL=F':     { name: 'WTI 유가' },
  // 금리
  '^TNX':     { name: '미 10년물 금리', suffix: '%' },
  '^IRX':     { name: '미 단기 금리', suffix: '%' },
};

const SYMBOL_LIST = Object.keys(SYMBOLS);

async function fetchWithFallback(symbols: string[]): Promise<MarketItem[]> {
  const results: MarketItem[] = [];

  try {
    const quotes = await yahooFinance.quote(
      symbols,
      {
        fields: [
          'regularMarketPrice',
          'regularMarketChange',
          'regularMarketChangePercent',
          'regularMarketPreviousClose',
          'currency',
          'shortName',
        ],
      },
      { validateResult: false }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: any[] = Array.isArray(quotes) ? quotes : [quotes];

    for (const q of arr) {
      const meta = SYMBOLS[q.symbol] ?? { name: q.shortName ?? q.symbol };
      results.push({
        symbol: q.symbol,
        name: meta.name,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChange ?? 0,
        changePercent: q.regularMarketChangePercent ?? 0,
        currency: q.currency ?? 'USD',
        suffix: meta.suffix,
      });
    }
  } catch {
    // Return error placeholders so UI still renders
    for (const sym of symbols) {
      const meta = SYMBOLS[sym] ?? { name: sym };
      results.push({
        symbol: sym,
        name: meta.name,
        price: 0,
        change: 0,
        changePercent: 0,
        error: true,
      });
    }
  }

  return results;
}

export async function GET() {
  const items = await fetchWithFallback(SYMBOL_LIST);

  const bySymbol: Record<string, MarketItem> = {};
  for (const item of items) bySymbol[item.symbol] = item;

  const pick = (...syms: string[]): MarketItem[] =>
    syms.map(s => bySymbol[s]).filter(Boolean);

  const sections = [
    {
      id: 'key',
      title: '핵심 지표',
      emoji: '🌸',
      items: pick('^KS11', '^KQ11', 'USDKRW=X', '^VIX', 'BTC-USD'),
    },
    {
      id: 'global',
      title: '글로벌 지수',
      emoji: '🌍',
      items: pick('NQ=F', 'ES=F', 'YM=F', 'RTY=F', '^RUT', '^SOX', '^N225'),
    },
    {
      id: 'commodity',
      title: '원자재',
      emoji: '✨',
      items: pick('GC=F', 'CL=F'),
    },
    {
      id: 'rates',
      title: '금리 / 채권',
      emoji: '💮',
      items: pick('^TNX', '^IRX'),
    },
  ];

  return NextResponse.json(
    { sections, updatedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
