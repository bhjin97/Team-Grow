'use client';

import * as React from 'react';
import { Star, Droplets } from 'lucide-react';

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';

interface SkinSummaryProps {
  code: string;
  koAxisWord: Record<AxisKey, string>;
  concerns: { key: AxisKey; label: string; value: number }[];
  selectedPeriod: string;
  setSelectedPeriod: (v: string) => void;
}

/** 라벨의 반대편 라벨(표시용) */
const OPPOSITE: Record<string, string> = {
  'OILY': 'DRY',
  'SENSITIVE': 'RESISTANCE',
  'NON-PIGMENTED': 'PIGMENTED',
  'TIGHT': 'WRINKLED',
};

/** 축별 칩/바 컬러 */
const AXIS_COLOR: Record<AxisKey, { main: string; soft: string }> = {
  OD: { main: '#06b6d4', soft: 'rgba(6,182,212,0.15)' },   // teal
  SR: { main: '#f472b6', soft: 'rgba(244,114,182,0.18)' }, // pink
  PN: { main: '#a78bfa', soft: 'rgba(167,139,250,0.18)' }, // violet
  WT: { main: '#34d399', soft: 'rgba(52,211,153,0.18)' },  // green
};

/** 16타입 팔레트(분포 차트와 일치) */
const TYPE_COLOR: Record<string, string> = {
  OSNT: '#f472b6', OSNW: '#fb7185', OSPT: '#e879f9', OSPW: '#c084fc',
  ORNT: '#f43f5e', ORNW: '#f97316', ORPT: '#d946ef', ORPW: '#a78bfa',
  DSNT: '#60a5fa', DSNW: '#38bdf8', DSPT: '#34d399', DSPW: '#10b981',
  DRNT: '#22c55e', DRNW: '#84cc16', DRPT: '#06b6d4', DRPW: '#14b8a6',
};

/** HEX → rgba(a) */
function hexToRgba(hex: string, alpha = 0.1) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 강도 접두사(간단판: 매우/꽤) */
function intensityWord(pct: number) {
  if (pct >= 95) return '매우 ';
  if (pct >= 90) return '꽤 ';
  return '';
}

export default function SkinSummary({
  code,
  koAxisWord,
  concerns,
  selectedPeriod,
  setSelectedPeriod,
}: SkinSummaryProps) {
  const axisDesc = `(${koAxisWord.OD}, ${koAxisWord.SR}, ${koAxisWord.PN}, ${koAxisWord.WT})`;

  // 칩 데이터(코드 순서에 맞춰 배치)
  const chips = [
    { key: 'OD' as AxisKey, text: koAxisWord.OD, color: AXIS_COLOR.OD },
    { key: 'SR' as AxisKey, text: koAxisWord.SR, color: AXIS_COLOR.SR },
    { key: 'PN' as AxisKey, text: koAxisWord.PN, color: AXIS_COLOR.PN },
    { key: 'WT' as AxisKey, text: koAxisWord.WT, color: AXIS_COLOR.WT },
  ];

  // 요약 생성용 퍼센트
  const pctByKey: Record<AxisKey, number> = {
    OD: concerns.find((c) => c.key === 'OD')?.value ?? 0,
    SR: concerns.find((c) => c.key === 'SR')?.value ?? 0,
    PN: concerns.find((c) => c.key === 'PN')?.value ?? 0,
    WT: concerns.find((c) => c.key === 'WT')?.value ?? 0,
  };

  const oneLiner =
    `${intensityWord(pctByKey.OD)}${koAxisWord.OD}이고 ` +
    `${intensityWord(pctByKey.SR)}${koAxisWord.SR}입니다. ` +
    `${intensityWord(pctByKey.PN)}${koAxisWord.PN}이고 ` +
    `${intensityWord(pctByKey.WT)}${koAxisWord.WT}입니다.`;

  // 타입 색상 기반 요약 박스 스타일
  const typeHex = TYPE_COLOR[code] ?? '#9ca3af';
  const typeSoftBg = hexToRgba(typeHex, 0.10); // 아주 옅게
  const typeSoftBorder = hexToRgba(typeHex, 0.22);
  const typeText = typeHex;

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-4 sm:p-6">
      {/* 헤더 */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 text-pink-500">
            <Star size={18} />
          </span>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">피부 요약</h2>
        </div>
        <p className="text-sm text-gray-500 mt-2 pl-[2.5rem]">
          최근 진단을 기반으로 한 바우만 타입과 주요 축 지표입니다.
        </p>
      </div>

      {/* 타입 + 축 칩 */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 text-pink-500">
            <Droplets size={18} />
          </span>
          <p className="text-lg sm:text-xl font-semibold text-gray-800">
            바우만 피부 타입 <span className="text-pink-500">{code}</span>
          </p>
        </div>

        {/* 4축 칩 */}
        <div className="flex flex-wrap gap-2 ml-[2.5rem] sm:ml-0">
          {chips.map((c) => (
            <span
              key={c.key}
              className="px-2.5 py-1 text-xs rounded-full font-medium"
              style={{
                color: c.color.main,
                background: c.color.soft,
                border: `1px solid ${c.color.main}22`,
              }}
            >
              {c.text}
            </span>
          ))}
        </div>
      </div>

      {/* 보조 설명 */}
      <p className="text-sm text-gray-500 mt-1 mb-4 pl-[2.5rem]">{axisDesc}</p>

      {/* 듀얼 스택 바 */}
      <div className="space-y-3">
        {concerns.map((c) => {
          const leftPct = Math.max(0, Math.min(100, c.value ?? 0));
          const rightPct = Math.max(0, 100 - leftPct);
          const axisColor = AXIS_COLOR[c.key];

          const showLeft  = !(leftPct <= 10);   // 0~10 구간이면 왼쪽 숨김
          const showRight = !(leftPct >= 90);   // 90~100 구간이면 오른쪽 숨김


          return (
            <div key={c.key}>
              {/* 라벨 행 */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-[13px] text-gray-700 ${showLeft ? '' : 'invisible'}`}
                  aria-hidden={!showLeft}
                >
                  {c.label}
                </span>
                <span
                  className={`text-[11px] text-gray-400 ${showRight ? '' : 'invisible'}`}
                  aria-hidden={!showRight}
                >
                  {OPPOSITE[c.label] ?? ''}
                </span>
              </div>


              {/* 바 컨테이너 */}
              <div className="relative w-full h-3 rounded-full overflow-hidden bg-gray-100">
                {/* 왼쪽(선택 축) */}
                <div
                  className="h-full"
                  style={{
                    width: `${leftPct}%`,
                    background: `linear-gradient(90deg, ${axisColor.main} 0%, ${axisColor.main} 100%)`,
                    transition: 'width .45s ease',
                  }}
                />
                {/* 오른쪽(반대 축) */}
                <div
                  className="absolute right-0 top-0 h-full"
                  style={{
                    width: `${rightPct}%`,
                    backgroundColor: '#E5E7EB',
                    transition: 'width .45s ease',
                  }}
                />
                {/* 중앙 퍼센트 텍스트 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] font-semibold text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.15)]">
                    {leftPct}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ▼ 한줄요약(타입 색상으로 옅게 강조 + 줄바꿈) */}
      <div
        className="mt-4 rounded-lg px-3 py-2 border"
        style={{ background: typeSoftBg, borderColor: typeSoftBorder }}
      >
        <span className="text-[13px] font-semibold" style={{ color: typeText }}>
          한줄요약:
        </span>
        <br />
        <span className="text-[15px] text-gray-800">
          {oneLiner}
        </span>
      </div>
    </div>
  );
}
