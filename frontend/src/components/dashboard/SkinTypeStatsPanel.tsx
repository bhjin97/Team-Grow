import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { API_BASE } from "../../lib/env";
import FourAxisSummary from "./FourAxisSummary";

type Interval = "all";
type Gender = "all" | "female" | "male" | "other" | "na";
type AgeBand = "all" | "10s" | "20s" | "30s" | "40s" | "50s" | "60s_plus";

interface DistItem { type: string; count: number; }
interface DistResp {
  total: number;
  unassigned: number;
  distribution: DistItem[];
  interval: Interval;
  gender: Gender;
  age_band: AgeBand;
}

interface Props {
  interval: Interval;
  gender: Gender;
  ageBand: AgeBand;
  className?: string;
  framed?: boolean; // 외곽 프레임 표시 여부(상단 큰 카드 안에서는 false)
}

/** 메인 팔레트(진한색) */
const TYPE_COLOR: Record<string, string> = {
  OSNT: "#f472b6", OSNW: "#fb7185", OSPT: "#e879f9", OSPW: "#c084fc",
  ORNT: "#f43f5e", ORNW: "#f97316", ORPT: "#d946ef", ORPW: "#a78bfa",
  DSNT: "#60a5fa", DSNW: "#38bdf8", DSPT: "#34d399", DSPW: "#10b981",
  DRNT: "#22c55e", DRNW: "#84cc16", DRPT: "#06b6d4", DRPW: "#14b8a6",
};

/** HEX → rgba */
function hexToRgba(hex: string, alpha = 1) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 차트는 연~한 파스텔 톤으로(배지와 톤 매칭) */
function softFill(hex: string) {
  return hexToRgba(hex, 0.6); // 살짝 연하게
}

/** 도넛 퍼센트 라벨: 조각 "정중앙" + 가독성 색상 */
const renderPercentLabel = (props: any) => {
  const {
    cx, cy, midAngle, innerRadius, outerRadius, percent, fill,
    payload,   // recharts payload (name, value, etc.)
  } = props;

  // ① 위치: 두 반지름의 정확한 중간(= 조각 중앙 두께)
  const RAD = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + Math.cos(-midAngle * RAD) * radius;
  const y = cy + Math.sin(-midAngle * RAD) * radius;

  const pct = Math.round(percent * 100);
  if (pct < 4) return null; // 너무 작은 조각은 생략(겹침 방지)

  // ② 글자색: 조각색의 명도 기준으로 자동 선택
  //    - 밝은 조각 → 아주 짙은 슬레이트(#0f172a)
  //    - 어두운 조각 → 흰색 + 살짝 그림자
  const hex = (fill || payload?.fill || '#999').replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  const textColor = luminance > 0.72 ? '#0f172a' : '#ffffff'; // 더 또렷한 대비값
  const textShadow = luminance > 0.72 ? 'none' : '0 0 3px rgba(0,0,0,.28)';

  return (
    <text
      x={x}
      y={y}
      fill={textColor}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
      style={{ textShadow }}
    >
      {pct}%
    </text>
  );
};



function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-[96vw] max-w-3xl rounded-2xl bg-white shadow-xl">
        <header className="flex items-center justify-between px-5 py-3 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm border hover:bg-gray-50">닫기</button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function TypeBadge({ label, pct, color }:{label:string; pct:number; color:string}) {
  // 배지는 부드러운 배경 + 본색 텍스트/점
  return (
    <div
      className="px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm"
      style={{
        background: hexToRgba(color, 0.12),
        border: `1px solid ${hexToRgba(color, 0.28)}`,
      }}
      title={`${label} ${pct}%`}
    >
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm font-medium" style={{ color }}>{label}</span>
      <span className="text-xs text-gray-600">{pct}%</span>
    </div>
  );
}

export default function SkinTypeStatsPanel({ interval, gender, ageBand, className, framed = true }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DistResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const url = `${API_BASE}/api/stats/baumann-distribution?interval=${interval}&gender=${gender}&age_band=${ageBand}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DistResp = await res.json();
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setErr(e.message ?? "fetch failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [interval, gender, ageBand]);

  // 시리즈 계산(%) — 0건인 타입은 자연스럽게 제외 → 16개 모두 있으면 16조각까지 표시됨
  const series = useMemo(() => {
    if (!data || data.total === 0) return [];
    return data.distribution
      .filter(d => d.count > 0)
      .map(d => ({
        name: d.type,
        value: +(d.count / data.total * 100).toFixed(2),
        color: TYPE_COLOR[d.type] ?? "#9ca3af",
        soft: softFill(TYPE_COLOR[d.type] ?? "#9ca3af"),
      }));
  }, [data]);

  // TOP3 + 기타(배지)
  const top3PlusOthers = useMemo(() => {
    const sorted = [...series].sort((a, b) => b.value - a.value);
    const top3 = sorted.slice(0, 3);
    const othersPct = Math.max(0, +(100 - top3.reduce((s, x) => s + x.value, 0)).toFixed(2));
    const items = top3.map(i => ({ label: i.name, pct: Math.round(i.value), color: i.color }));
    if (othersPct > 0) items.push({ label: '기타', pct: Math.round(othersPct), color: '#94a3b8' });
    return items;
  }, [series]);

  return (
    <div className={className}>
      {/* 모달 트리거 */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          피부 특징 요약 보기
        </button>
      </div>

      {/* 본체 (frameless 옵션) */}
      <div className={framed ? "rounded-2xl border border-[#0000000d] bg-white p-4 sm:p-6" : ""}>
        <div className="text-sm text-gray-500 mb-3">
          보기 조건 — 성별: <b>{gender}</b>, 연령대: <b>{ageBand}</b>
        </div>

        {loading && <div className="text-sm text-gray-500">불러오는 중…</div>}
        {err && <div className="text-sm text-red-500">데이터 오류: {err}</div>}

        {!loading && !err && data && (
          <>
            {data.total === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500">
                표본 수가 부족합니다.
              </div>
            ) : (
              <>
                {/* 차트 */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={series}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        stroke="#ffffff"
                        strokeWidth={2}
                        labelLine={false}
                        label={renderPercentLabel} // ✅ 퍼센트 상시 노출
                      >
                        {series.map((s, i) => (
                          <Cell key={i} fill={s.soft} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number, _n, e: any) => [`${v}%`, e?.payload?.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 상위 타입(배지 톤 = 차트 톤과 매칭) */}
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">상위 타입</div>
                  <div className="flex flex-wrap gap-2">
                    {top3PlusOthers.map(b => (
                      <TypeBadge key={b.label} label={b.label} pct={b.pct} color={TYPE_COLOR[b.label] ?? '#94a3b8'} />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="mt-3 text-xs text-gray-500">
              표본 수: <b>{data.total.toLocaleString()}</b>
              {data.unassigned ? <> · 미설정: {data.unassigned.toLocaleString()}</> : null}
            </div>
          </>
        )}
      </div>

      {/* 모달(4축 요약) */}
      <Modal open={open} onClose={() => setOpen(false)} title="피부 타입 한눈에 (OD / SR / PN / WT)">
        <FourAxisSummary interval="all" gender={gender} ageBand={ageBand} />
      </Modal>
    </div>
  );
}
