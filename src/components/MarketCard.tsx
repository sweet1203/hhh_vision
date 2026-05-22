"use client";

import type { MarketItem } from "@/types/market";

interface Props {
  item: MarketItem;
  sparkline?: number[];
}

// ── 숫자 포맷 ──────────────────────────────────────────
function formatPrice(price: number, symbol: string, suffix?: string): string {
  if (price === 0) return "—";
  if (suffix) return price.toFixed(2) + suffix;
  if (symbol === "USDKRW=X") return price.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (symbol === "BTC-USD") return price.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  if (price >= 10000) return price.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(2);
  return price.toFixed(2);
}

function formatChange(change: number, suffix?: string): string {
  if (change === 0) return "0.00";
  const sign = change >= 0 ? "+" : "";
  if (suffix) return sign + change.toFixed(2) + suffix;
  if (Math.abs(change) >= 1) return sign + change.toFixed(2);
  return sign + change.toFixed(4);
}

function formatChangePct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return sign + pct.toFixed(2) + "%";
}

// ── 스파크라인 SVG ──────────────────────────────────────
function Sparkline({ prices, isUp }: { prices: number[]; isUp: boolean }) {
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || Math.abs(min) * 0.002 || 1;
  const W = 64, H = 28, pad = 2;

  const toX = (i: number) => pad + (i / (prices.length - 1)) * (W - pad * 2);
  const toY = (p: number) => (H - pad) - ((p - min) / range) * (H - pad * 2);

  const pts = prices.map((p, i) =>
    `${toX(i).toFixed(1)},${toY(p).toFixed(1)}`
  );
  const linePts = pts.join(" ");
  const areaD =
    `M${toX(0).toFixed(1)},${H} ` +
    pts.map((pt) => `L${pt}`).join(" ") +
    ` L${toX(prices.length - 1).toFixed(1)},${H} Z`;

  const color = isUp ? "#16a34a" : "#dc2626";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      <path d={areaD} fill={color} fillOpacity={0.1} />
      <polyline
        points={linePts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── 마감 뱃지 ───────────────────────────────────────────
const STATE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  CLOSED:   { label: "마감",  bg: "rgba(234,179,8,0.15)",   color: "#92400e" },
  PRE:      { label: "프리",  bg: "rgba(59,130,246,0.12)",  color: "#1e40af" },
  POST:     { label: "시간외", bg: "rgba(147,51,234,0.12)", color: "#6b21a8" },
  POSTPOST: { label: "시간외", bg: "rgba(147,51,234,0.12)", color: "#6b21a8" },
};

// ── 카드 컴포넌트 ────────────────────────────────────────
export function MarketCard({ item, sparkline }: Props) {
  const isUp = item.change >= 0;
  const isError = item.error || item.price === 0;
  const badge = item.marketState ? STATE_BADGE[item.marketState] : null;

  return (
    <div
      className="rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: "var(--surface)",
        borderColor: isError
          ? "var(--border)"
          : isUp
          ? "rgba(22,163,74,0.25)"
          : "rgba(220,38,38,0.25)",
        boxShadow: isError
          ? "none"
          : isUp
          ? "0 0 12px rgba(22,163,74,0.07)"
          : "0 0 12px rgba(220,38,38,0.07)",
      }}
    >
      {/* 상단: 지표명 + 마감 뱃지 */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <p
          className="text-xs font-semibold tracking-wide truncate"
          style={{ color: "var(--text-muted)" }}
        >
          {item.name}
        </p>
        {badge && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
            style={{ background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* 중단: 현재가 + 스파크라인 */}
      <div className="flex items-end justify-between gap-2">
        {isError ? (
          <p className="text-xl font-bold" style={{ color: "var(--text-faint)" }}>
            —
          </p>
        ) : (
          <p
            className="text-xl font-bold tabular-nums leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {formatPrice(item.price, item.symbol, item.suffix)}
          </p>
        )}
        {!isError && sparkline && sparkline.length >= 2 && (
          <Sparkline prices={sparkline} isUp={isUp} />
        )}
      </div>

      {/* 하단: 등락 */}
      {!isError && (
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: isUp
                ? "rgba(22,163,74,0.12)"
                : "rgba(220,38,38,0.12)",
              color: isUp ? "var(--green)" : "var(--red)",
            }}
          >
            {item.label ?? formatChangePct(item.changePercent)}
          </span>
          {!item.label && (
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--text-faint)" }}
            >
              {formatChange(item.change, item.suffix)}
            </span>
          )}
        </div>
      )}

      {isError && (
        <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
          데이터 로드 실패
        </p>
      )}
    </div>
  );
}

export function MarketCardSkeleton() {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="skeleton h-3 w-24 mb-3" />
      <div className="skeleton h-6 w-20 mb-2" />
      <div className="skeleton h-4 w-28" />
    </div>
  );
}
