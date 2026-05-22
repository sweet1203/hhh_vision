import { NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import type { MarketItem } from '@/types/market';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  validation: { logErrors: false, logOptionsErrors: false },
});

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
  'NG=F':     { name: '천연가스' },
  'DX-Y.NYB': { name: '달러인덱스 (DXY)' },
  // 금리
  '^TNX':     { name: '미 10년물 금리', suffix: '%' },
  '^IRX':     { name: '미 단기 금리 (3M)', suffix: '%' },
};

const SYMBOL_LIST = Object.keys(SYMBOLS);

// CNN 공포탐욕지수 fetch
async function fetchCNNFearGreed(): Promise<MarketItem | null> {
  try {
    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': 'https://edition.cnn.com/markets/fear-and-greed',
        },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const score = Math.round(data.fear_and_greed?.score ?? 0);
    const rating: string = data.fear_and_greed?.rating ?? '';
    const labelMap: Record<string, string> = {
      'extreme fear': '극도의 공포',
      'fear': '공포',
      'neutral': '중립',
      'greed': '탐욕',
      'extreme greed': '극도의 탐욕',
    };
    return {
      symbol: 'CNN_FG',
      name: 'CNN 공포탐욕',
      price: score,
      // score < 50 → fear(red), score > 50 → greed(green) — 카드 색상 자동 반영
      change: score - 50,
      changePercent: ((score - 50) / 50) * 100,
      label: labelMap[rating.toLowerCase()] ?? rating,
      currency: 'INDEX',
    };
  } catch {
    return null;
  }
}

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
  // Yahoo Finance + CNN 병렬 fetch
  const [items, cnnFG] = await Promise.all([
    fetchWithFallback(SYMBOL_LIST),
    fetchCNNFearGreed(),
  ]);

  const bySymbol: Record<string, MarketItem> = {};
  for (const item of items) bySymbol[item.symbol] = item;
  if (cnnFG) bySymbol['CNN_FG'] = cnnFG;

  // 장단기 금리차 계산 (10년 - 3개월)
  const tnx = bySymbol['^TNX'];
  const irx = bySymbol['^IRX'];
  if (tnx && !tnx.error && irx && !irx.error) {
    const spread = parseFloat((tnx.price - irx.price).toFixed(3));
    const spreadChange = parseFloat(((tnx.change ?? 0) - (irx.change ?? 0)).toFixed(3));
    bySymbol['YIELD_SPREAD'] = {
      symbol: 'YIELD_SPREAD',
      name: '장단기 금리차',
      price: spread,
      change: spreadChange,
      changePercent: 0,
      suffix: '%p',
      currency: 'INDEX',
    };
  }

  const pick = (...syms: string[]): MarketItem[] =>
    syms.map(s => bySymbol[s]).filter(Boolean);

  const sections = [
    {
      id: 'key',
      title: '핵심 지표',
      emoji: '📊',
      items: pick('^KS11', '^KQ11', 'USDKRW=X', '^VIX', 'CNN_FG', 'BTC-USD'),
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
      emoji: '⚡',
      items: pick('GC=F', 'CL=F', 'NG=F', 'DX-Y.NYB'),
    },
    {
      id: 'rates',
      title: '금리 / 채권',
      emoji: '📈',
      items: pick('^TNX', '^IRX', 'YIELD_SPREAD'),
    },
  ];

  // extras: CNN_FG, YIELD_SPREAD 등 Yahoo Finance 외 특수 아이템
  const extras = [cnnFG, bySymbol['YIELD_SPREAD']].filter(Boolean);

  return NextResponse.json(
    { sections, extras, updatedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
