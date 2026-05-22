"use client";

import { useEffect, useState, useCallback } from "react";
import type { MarketSection } from "@/types/market";
import { MarketCard, MarketCardSkeleton } from "@/components/MarketCard";

const REFRESH_INTERVAL = 30_000; // 30초

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Skeleton loader for a section
function SectionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <MarketCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [sections, setSections] = useState<MarketSection[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isAuto = false) => {
    if (isAuto) setRefreshing(true);
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      const data = await res.json();
      setSections(data.sections ?? []);
      setUpdatedAt(data.updatedAt ?? "");
    } catch (e) {
      console.error("fetch error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchData]);

  return (
    <div className="min-h-dvh px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ── */}
        <header className="mb-8">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title */}
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight gradient-title">
                🌸 KOSPI 선행지표
              </h1>
              <span
                className="hidden sm:block text-xs font-medium px-2 py-0.5 rounded-full border"
                style={{ color: "var(--text-faint)", borderColor: "var(--border)" }}
              >
                실시간
              </span>
            </div>

            {/* Refresh indicator */}
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

          {/* Subtitle */}
          <p className="mt-1 text-sm" style={{ color: "var(--text-faint)" }}>
            코스피 · 글로벌 지수 · 원자재 · 금리 — 30초마다 자동 갱신
          </p>

          {/* Divider */}
          <div
            className="mt-4 h-px"
            style={{
              background:
                "linear-gradient(to right, var(--pink-bright), transparent)",
              opacity: 0.4,
            }}
          />
        </header>

        {/* ── Sections ── */}
        {loading ? (
          <div className="space-y-10">
            {[
              { title: "🌸 핵심 지표", count: 5 },
              { title: "🌍 글로벌 지수", count: 7 },
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
          <div className="space-y-10 fade-in">
            {sections.map((sec) => (
              <section key={sec.id}>
                {/* Section heading */}
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

                {/* Cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {sec.items.map((item) => (
                    <MarketCard key={item.symbol} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="mt-16 pb-8">
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
            🌸 Made with Next.js · Vercel
          </p>
        </footer>
      </div>
    </div>
  );
}
