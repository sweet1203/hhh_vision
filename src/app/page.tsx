"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { MarketSection, MarketItem } from "@/types/market";
import { MarketCard, MarketCardSkeleton } from "@/components/MarketCard";

const REFRESH_INTERVAL = 30_000; // 30초

type Mode = "kospi" | "nasdaq";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SectionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}

// 심볼 맵으로부터 모드별 섹션 구성
function buildSections(
  bySymbol: Record<string, MarketItem>,
  mode: Mode
): MarketSection[] {
  const pick = (...syms: string[]): MarketItem[] =>
    syms.map((s) => bySymbol[s]).filter(Boolean);

  if (mode === "kospi") {
    return [
      {
        id: "key",
        title: "핵심 지표",
        emoji: "📊",
        items: pick("^KS11", "^KQ11", "USDKRW=X", "^VIX", "CNN_FG", "BTC-USD"),
      },
      {
        id: "global",
        title: "글로벌 지수",
        emoji: "🌍",
        items: pick("NQ=F", "ES=F", "YM=F", "^N225"),
      },
      {
        id: "commodity",
        title: "원자재",
        emoji: "⚡",
        items: pick("GC=F", "CL=F", "NG=F", "DX-Y.NYB"),
      },
      {
        id: "rates",
        title: "금리 / 채권",
        emoji: "📈",
        items: pick("^TNX", "^IRX", "YIELD_SPREAD"),
      },
    ];
  } else {
    // NASDAQ 모드 — 러셀2000 선물 + 현물 모두 표시
    return [
      {
        id: "us",
        title: "미국 지수",
        emoji: "🦅",
        items: pick("NQ=F", "ES=F", "YM=F", "RTY=F", "^RUT"),
      },
      {
        id: "tech",
        title: "기술 / 반도체",
        emoji: "💻",
        items: pick("^SOX"),
      },
      {
        id: "asia",
        title: "아시아 지수",
        emoji: "🌏",
        items: pick("^N225", "^KS11", "^KQ11"),
      },
      {
        id: "safe",
        title: "안전자산",
        emoji: "🔒",
        items: pick("USDKRW=X", "DX-Y.NYB", "GC=F", "CL=F", "NG=F", "^VIX", "CNN_FG", "BTC-USD"),
      },
      {
        id: "rates",
        title: "금리 / 채권",
        emoji: "📈",
        items: pick("^TNX", "^IRX", "YIELD_SPREAD"),
      },
      {
        id: "mag7",
        title: "Magnificent 7",
        emoji: "🚀",
        items: pick("NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"),
      },
    ];
  }
}

// ── 스파크라인: localStorage에 가격 기록 축적 ─────────────
const SPARK_KEY = "hhh_spark_v1";
const SPARK_MAX = 50;

function loadSpark(): Record<string, number[]> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(SPARK_KEY) ?? "{}"); } catch { return {}; }
}
function saveSpark(data: Record<string, number[]>) {
  try { localStorage.setItem(SPARK_KEY, JSON.stringify(data)); } catch {}
}

export default function Dashboard() {
  const [bySymbol, setBySymbol] = useState<Record<string, MarketItem>>({});
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>("kospi");
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const sparkRef = useRef<Record<string, number[]>>({});

  const fetchData = useCallback(async (isAuto = false) => {
    if (isAuto) setRefreshing(true);
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      const data = await res.json();
      // 모든 아이템을 심볼 맵으로 평탄화
      const map: Record<string, MarketItem> = {};
      for (const sec of data.sections ?? []) {
        for (const item of sec.items) {
          map[item.symbol] = item;
        }
      }
      // CNN F&G, 장단기 금리차 등 특수 계산 아이템
      for (const item of data.extras ?? []) {
        map[item.symbol] = item;
      }
      setBySymbol(map);
      setUpdatedAt(data.updatedAt ?? "");
    } catch (e) {
      console.error("fetch error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // localStorage에서 스파크라인 불러오기 (최초 1회)
  useEffect(() => {
    const stored = loadSpark();
    sparkRef.current = stored;
    setSparklines(stored);
  }, []);

  // 가격 갱신될 때마다 스파크라인 기록 추가
  useEffect(() => {
    if (Object.keys(bySymbol).length === 0) return;
    const updated = { ...sparkRef.current };
    let changed = false;
    for (const [sym, item] of Object.entries(bySymbol)) {
      if (item.price > 0 && !item.error) {
        const hist = updated[sym] ?? [];
        const last = hist[hist.length - 1];
        if (last !== item.price) {
          updated[sym] = [...hist.slice(-(SPARK_MAX - 1)), item.price];
          changed = true;
        }
      }
    }
    if (changed) {
      sparkRef.current = updated;
      setSparklines(updated);
      saveSpark(updated);
    }
  }, [bySymbol]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  const sections = useMemo(
    () => buildSections(bySymbol, mode).filter((s) => s.items.length > 0),
    [bySymbol, mode]
  );

  const toggleMode = () => setMode((m) => (m === "kospi" ? "nasdaq" : "kospi"));

  return (
    <div className="min-h-dvh px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ── */}
        <header className="mb-8">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title */}
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight gradient-title">
                {mode === "kospi" ? "📊 KOSPI 선행지표" : "🦅 NASDAQ 지수"}
              </h1>
              <span
                className="hidden sm:block text-xs font-medium px-2 py-0.5 rounded-full border"
                style={{ color: "var(--text-faint)", borderColor: "var(--border)" }}
              >
                실시간
              </span>
            </div>

            {/* 오른쪽: 모드 토글 + 새로고침 */}
            <div className="flex items-center gap-3">
              {/* 모드 토글 버튼 (데스크탑) */}
              <div
                className="hidden sm:flex items-center rounded-xl border p-1 gap-0.5"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <button
                  onClick={() => setMode("kospi")}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold"
                  style={
                    mode === "kospi"
                      ? {
                          background:
                            "linear-gradient(135deg, var(--pink-dark), var(--pink-bright))",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(236,72,153,0.4)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  🇰🇷 KOSPI
                </button>
                <button
                  onClick={() => setMode("nasdaq")}
                  className="text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-semibold"
                  style={
                    mode === "nasdaq"
                      ? {
                          background:
                            "linear-gradient(135deg, var(--pink-dark), var(--pink-bright))",
                          color: "#fff",
                          boxShadow: "0 2px 8px rgba(236,72,153,0.4)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  🇺🇸 NASDAQ
                </button>
              </div>

              {/* 새로고침 인디케이터 + 버튼 */}
              <div className="flex items-center gap-2">
                {refreshing && (
                  <span
                    className="text-xs animate-pulse"
                    style={{ color: "var(--pink)" }}
                  >
                    새로고침 중…
                  </span>
                )}
                {updatedAt && (
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-faint)" }}
                  >
                    🕐 {formatTime(updatedAt)}
                  </span>
                )}
                <button
                  onClick={() => fetchData(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 active:scale-95"
                  style={{
                    borderColor: "var(--border-glow)",
                    color: "var(--pink)",
                    background: "rgba(244,114,182,0.08)",
                  }}
                >
                  ↺ 새로고침
                </button>
              </div>
            </div>
          </div>

          {/* 부제목 */}
          <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
            {mode === "kospi"
              ? "코스피 · 글로벌 지수 · 원자재 · 금리 — 30초마다 자동 갱신"
              : "나스닥100 · S&P500 · 러셀2000 · 반도체 — 30초마다 자동 갱신"}
          </p>

          {/* 구분선 */}
          <div
            className="mt-4 h-px"
            style={{
              background:
                "linear-gradient(to right, var(--pink-bright), transparent)",
              opacity: 0.4,
            }}
          />
        </header>

        {/* ── 섹션 목록 ── */}
        {loading ? (
          <div className="space-y-10">
            {[
              { title: "📊 핵심 지표", count: 5 },
              { title: "🌍 글로벌 지수", count: 4 },
              { title: "✨ 원자재", count: 2 },
              { title: "💮 금리 / 채권", count: 2 },
            ].map((s) => (
              <section key={s.title}>
                <h2
                  className="text-base font-bold mb-3"
                  style={{ color: "var(--pink)" }}
                >
                  {s.title}
                </h2>
                <SectionSkeleton count={s.count} />
              </section>
            ))}
          </div>
        ) : (
          <div key={mode} className="space-y-10 fade-in">
            {sections.map((sec) => (
              <section key={sec.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{sec.emoji}</span>
                  <h2
                    className="text-base font-bold"
                    style={{ color: "var(--pink)" }}
                  >
                    {sec.title}
                  </h2>
                  <span
                    className="text-xs"
                    style={{ color: "var(--text-faint)" }}
                  >
                    ({sec.items.length})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {sec.items.map((item) => (
                    <MarketCard
                      key={item.symbol}
                      item={item}
                      sparkline={sparklines[item.symbol]}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-16 pb-20 sm:pb-8">
          <div
            className="h-px mb-6"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--border), transparent)",
            }}
          />
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            본 서비스는 개인 투자 참고용이며 투자 권유가 아닙니다. 시세
            정보는 Yahoo Finance 기준으로 지연될 수 있습니다.
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "var(--text-faint)", opacity: 0.6 }}
          >
            💻 Made with Next.js · Vercel
          </p>
        </footer>
      </div>

      {/* ── 모바일 플로팅 토글 버튼 ── */}
      <button
        onClick={toggleMode}
        className="sm:hidden fixed bottom-6 right-5 w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-transform duration-200 active:scale-90 z-50"
        style={{
          background: "linear-gradient(135deg, var(--pink-dark), var(--pink-bright))",
          boxShadow: "0 4px 24px rgba(236,72,153,0.5)",
        }}
        aria-label={mode === "kospi" ? "미국 지수로 전환" : "한국 지수로 전환"}
      >
        {mode === "kospi" ? "🇺🇸" : "🇰🇷"}
      </button>
    </div>
  );
}
