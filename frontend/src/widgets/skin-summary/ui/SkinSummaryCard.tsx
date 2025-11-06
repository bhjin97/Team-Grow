import { Star, Droplets } from 'lucide-react';
import {
  AxisKey,
  SkinConcern,
  AXIS_LABELS,
  AXIS_COLORS,
  TYPE_COLORS,
  hexToRgba,
  generateSkinSummary,
} from '@/entities/skin';
import { Card } from '@/shared/ui';

export interface SkinSummaryCardProps {
  code: string;
  koAxisWord: Record<AxisKey, string>;
  concerns: SkinConcern[];
  variant?: 'default' | 'compact';
}

export const SkinSummaryCard = ({
  code,
  koAxisWord,
  concerns,
  variant = 'default',
}: SkinSummaryCardProps) => {
  const axisDesc = `(${koAxisWord.OD}, ${koAxisWord.SR}, ${koAxisWord.PN}, ${koAxisWord.WT})`;

  // 칩 데이터
  const chips = [
    { key: 'OD' as AxisKey, text: koAxisWord.OD, color: AXIS_COLORS.OD },
    { key: 'SR' as AxisKey, text: koAxisWord.SR, color: AXIS_COLORS.SR },
    { key: 'PN' as AxisKey, text: koAxisWord.PN, color: AXIS_COLORS.PN },
    { key: 'WT' as AxisKey, text: koAxisWord.WT, color: AXIS_COLORS.WT },
  ];

  // 타입 색상
  const typeHex = TYPE_COLORS[code] ?? '#9ca3af';
  const typeSoftBg = hexToRgba(typeHex, 0.1);
  const typeSoftBorder = hexToRgba(typeHex, 0.22);
  const typeText = typeHex;

  // 한줄 요약
  const oneLiner = generateSkinSummary(koAxisWord, concerns);

  return (
    <Card padding={variant === 'compact' ? 'md' : 'lg'} className="bg-white/90 backdrop-blur-sm">
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
          {chips.map(c => (
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
        {concerns.map(c => {
          const leftPct = Math.max(0, Math.min(100, c.value ?? 0));
          const rightPct = Math.max(0, 100 - leftPct);
          const axisColor = AXIS_COLORS[c.key];
          const opposite = AXIS_LABELS[c.label]?.right ?? '';

          return (
            <div key={c.key}>
              {/* 라벨 행 */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-gray-700">{c.label}</span>
                <span className="text-[11px] text-gray-400">{opposite}</span>
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

      {/* 한줄 요약 */}
      <div
        className="mt-4 rounded-lg px-3 py-2 border"
        style={{ background: typeSoftBg, borderColor: typeSoftBorder }}
      >
        <span className="text-[13px] font-semibold" style={{ color: typeText }}>
          한줄요약:
        </span>
        <br />
        <span className="text-[15px] text-gray-800">{oneLiner}</span>
      </div>
    </Card>
  );
};
