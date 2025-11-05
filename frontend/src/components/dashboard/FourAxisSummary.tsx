import * as React from "react";
import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/env";

type Interval = "all";
type Gender = "all" | "female" | "male" | "other" | "na";
type AgeBand = "all" | "10s" | "20s" | "30s" | "40s" | "50s" | "60s_plus";

interface Axes {
  OD: { O: number; D: number };
  SR: { S: number; R: number };
  PN: { N: number; P: number };
  WT: { T: number; W: number };
}
interface Resp {
  total: number;
  axes: Axes;
  interval: Interval;
  gender: Gender;
  age_band: AgeBand;
}

interface Props {
  interval: Interval;
  gender: Gender;
  ageBand: AgeBand;
  className?: string;
}

// 축별 컬러(왼/오)
const AXIS_COLORS = {
  OD: { L: "#06b6d4", R: "#e5e7eb" }, // OILY vs DRY
  SR: { L: "#f472b6", R: "#e5e7eb" }, // SENSITIVE vs RESISTANCE
  PN: { L: "#a78bfa", R: "#e5e7eb" }, // NON-PIGMENTED vs PIGMENTED
  WT: { L: "#34d399", R: "#e5e7eb" }, // TIGHT vs WRINKLED
};

function DualBar({
  leftPct, rightPct, leftLabel, rightLabel, colors,
}: {
  leftPct: number; rightPct: number; leftLabel: string; rightLabel: string;
  colors: { L: string; R: string };
}) {
  return (
    <div className="rounded-2xl border border-[#0000000d] bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-600">{leftLabel}</span>
        <span className="text-xs text-gray-600">{rightLabel}</span>
      </div>
      <div className="h-3 w-full rounded-full overflow-hidden flex">
        <div style={{ width: `${leftPct}%`, backgroundColor: colors.L }} />
        <div style={{ width: `${rightPct}%`, backgroundColor: colors.R }} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: colors.L }}>{Math.round(leftPct)}%</span>
        <span className="text-sm font-semibold text-gray-500">{Math.round(rightPct)}%</span>
      </div>
    </div>
  );
}

export default function FourAxisSummary({ interval, gender, ageBand, className }: Props) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const url = `${API_BASE}/api/stats/axis-summary?interval=${interval}&gender=${gender}&age_band=${ageBand}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: Resp = await res.json();
        if (alive) setData(json);
      } catch (e:any) {
        if (alive) setErr(e.message ?? "fetch failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [interval, gender, ageBand]);

  if (loading) return <div className={className}>불러오는 중…</div>;
  if (err) return <div className={(className ?? "") + " text-red-500"}>데이터 오류: {err}</div>;

  return (
    <div className={className}>
      {!data || data.total === 0 ? (
        <div className="h-28 sm:h-24 flex items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
          표본 수가 부족합니다.
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500 mb-3">
            필터 — 성별: <b>{gender}</b>, 연령대: <b>{ageBand}</b> · 표본 수: <b>{data.total.toLocaleString()}</b>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DualBar
              leftPct={data.axes.OD.O} rightPct={data.axes.OD.D}
              leftLabel="OILY" rightLabel="DRY" colors={AXIS_COLORS.OD}
            />
            <DualBar
              leftPct={data.axes.SR.S} rightPct={data.axes.SR.R}
              leftLabel="SENSITIVE" rightLabel="RESISTANCE" colors={AXIS_COLORS.SR}
            />
            <DualBar
              leftPct={data.axes.PN.N} rightPct={data.axes.PN.P}
              leftLabel="NON-PIGMENTED" rightLabel="PIGMENTED" colors={AXIS_COLORS.PN}
            />
            <DualBar
              leftPct={data.axes.WT.T} rightPct={data.axes.WT.W}
              leftLabel="TIGHT" rightLabel="WRINKLED" colors={AXIS_COLORS.WT}
            />
          </div>
        </>
      )}
    </div>
  );
}
