'use client';

import * as React from 'react';
import { Star, Droplets } from 'lucide-react';

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';

interface SkinSummaryProps {
  code: string;
  koAxisWord: Record<AxisKey, string>;
  concerns: { key: AxisKey; label: string; value: number; displayValue?: number }[];
  selectedPeriod: string;
  setSelectedPeriod: (v: string) => void;
}

/** 라벨 매핑 (왼쪽 고정) */
const LEFT_LABEL: Record<AxisKey, string> = {
  OD: 'OILY',
  SR: 'SENSITIVE',
  PN: 'PIGMENTED',
  WT: 'WRINKLED',
};

/** 라벨 매핑 (오른쪽 고정) */
const RIGHT_LABEL: Record<AxisKey, string> = {
  OD: 'DRY',
  SR: 'RESISTANCE',
  PN: 'NON-PIGMENTED',
  WT: 'TIGHT',
};

/** 축별 칩/바 컬러 (양방향 - 같은 계열 톤) */
const AXIS_COLOR: Record<AxisKey, { main: string; soft: string; leftBar: string; rightBar: string }> = {
  OD: { 
    main: '#06b6d4', 
    soft: 'rgba(6,182,212,0.15)',
    leftBar: '#06b6d4',  // DRY - 진한 cyan
    rightBar: '#67e8f9'  // OILY - 연한 cyan
  },
  SR: { 
    main: '#f472b6', 
    soft: 'rgba(244,114,182,0.18)',
    leftBar: '#f472b6',  // SENSITIVE - 진한 pink
    rightBar: '#fbcfe8'  // RESISTANCE - 연한 pink
  },
  PN: { 
    main: '#a78bfa', 
    soft: 'rgba(167,139,250,0.18)',
    leftBar: '#a78bfa',  // PIGMENTED - 진한 violet
    rightBar: '#d8b4fe'  // NON-PIGMENTED - 연한 violet
  },
  WT: { 
    main: '#34d399', 
    soft: 'rgba(52,211,153,0.18)',
    leftBar: '#34d399',  // WRINKLED - 진한 green
    rightBar: '#86efac'  // TIGHT - 연한 green
  },
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

  // 요약 생성용 퍼센트 (displayValue 사용)
  const pctByKey: Record<AxisKey, number> = {
    OD: concerns.find((c) => c.key === 'OD')?.displayValue ?? concerns.find((c) => c.key === 'OD')?.value ?? 0,
    SR: concerns.find((c) => c.key === 'SR')?.displayValue ?? concerns.find((c) => c.key === 'SR')?.value ?? 0,
    PN: concerns.find((c) => c.key === 'PN')?.displayValue ?? concerns.find((c) => c.key === 'PN')?.value ?? 0,
    WT: concerns.find((c) => c.key === 'WT')?.displayValue ?? concerns.find((c) => c.key === 'WT')?.value ?? 0,
  };

  const oneLiner =
    `${intensityWord(pctByKey.OD)}${koAxisWord.OD}이고 ` +
    `${intensityWord(pctByKey.SR)}${koAxisWord.SR}입니다. ` +
    `${intensityWord(pctByKey.PN)}${koAxisWord.PN}이고 ` +
    `${intensityWord(pctByKey.WT)}${koAxisWord.WT}입니다.`;

  // 타입 색상 기반 요약 박스 스타일
  const typeHex = TYPE_COLOR[code] ?? '#9ca3af';
  const typeSoftBg = hexToRgba(typeHex, 0.10);
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

      {/* 중앙 기준 양방향 바 */}
      <div className="space-y-3">
        {concerns.map((c) => {
          const value = Math.max(0, Math.min(100, c.value ?? 50));
          const displayValue = c.displayValue ?? value; // ← 화면 표시용
          const neutral = 50;
          const deviation = value - neutral; // -50 ~ +50
          
          const axisColor = AXIS_COLOR[c.key];
          
          // 왼쪽으로 뻗는 정도 (0-50)
          const leftExtend = Math.max(0, deviation);
          // 오른쪽으로 뻗는 정도 (0-50)
          const rightExtend = Math.max(0, -deviation);
          
          // 바 색상
          const barColor = deviation >= 0 ? axisColor.leftBar : axisColor.rightBar;

          return (
            <div key={c.key}>
              {/* 라벨 행 - 왼쪽 O/S/P/W, 오른쪽 D/R/N/T 고정 */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] font-medium text-gray-700">
                  {LEFT_LABEL[c.key]}
                </span>
                <span className="text-[13px] font-medium text-gray-700">
                  {RIGHT_LABEL[c.key]}
                </span>
              </div>

              {/* 바 컨테이너 */}
              <div className="relative w-full h-4 rounded-full overflow-hidden bg-gray-100">
                {/* 왼쪽으로 뻗는 바 - 끝이 진하게 */}
                {deviation >= 0 && (
                  <div
                    className="absolute top-0 h-full transition-all duration-500 ease-out"
                    style={{
                      right: '50%',
                      width: `${leftExtend}%`,
                      background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 70%, ${barColor}aa 100%)`,
                    }}
                  />
                )}
                
                {/* 오른쪽으로 뻗는 바 - 끝이 진하게 */}
                {deviation < 0 && (
                  <div
                    className="absolute top-0 h-full transition-all duration-500 ease-out"
                    style={{
                      left: '50%',
                      width: `${rightExtend}%`,
                      background: `linear-gradient(90deg, ${barColor}aa 0%, ${barColor}dd 30%, ${barColor} 100%)`,
                    }}
                  />
                )}

                {/* 중앙선 */}
                <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-400 -translate-x-1/2 z-10"></div>

                {/* 퍼센트 표시 - displayValue 사용 */}
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <span className="text-[11px] font-bold text-gray-700 bg-white/80 px-1.5 py-0.5 rounded">
                    {displayValue}%
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