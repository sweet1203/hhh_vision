"use client";

import type { MarketItem } from "@/types/market";

interface Props {
  item: MarketItem;
}

function formatPrice(price: number, symbol: string, suffix?: string): string {
  if (price === 0) return "—";
  if (suffix) return price.toFixed(2) + suffix;
  if (symbol === "USDKRW=X") return price.toFixed(2);
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

export function MarketCard({ item }: Props) {
  const isUp = item.change >= 0;
  const isError = item.error || item.price === 0;

  return (
    <div
      className="rounded-2xl border p-4 transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: "var(--surface)",
        borderColor: isError ? "var(--border)" : isUp ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)",
        boxShadow: isError
          ? "none"
          : isUp
          ? "0 0 12px rgba(52,211,153,0.08)"
          : "0 0 12px rgba(248,113,113,0.08)",
      }}
    >
      {/* 지표명 */}
      <p
        className="text-xs font-semibold tracking-wide truncate mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {item.name}
      </p>

      {/* 현재가 */}
      {isError ? (
        <p className="text-xl font-bold" style={{ color: "var(--text-faint)" }}>
          —
        </p>
      ) : (
        <p className="text-xl font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {formatPrice(item.price, item.symbol, item.suffix)}
        </p>
      )}

      {/* 등락 */}
      {!isError && (
        <div className="flex items-center gap-1.5 mt-1.5">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              color: isUp ? "var(--green)" : "var(--red)",
            }}
          >
            {formatChangePct(item.changePercent)}
          </span>
          <span className="text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
            {formatChange(item.change, item.suffix)}
          </span>
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
