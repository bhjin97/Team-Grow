// src/components/common/LoadingMascot.tsx
import * as React from 'react';

type LoadingMascotProps = {
  label?: string;
  /** public 기준 절대경로. 예: "/mascot/mascot.webp" */
  src?: string;
  /** 이미지 크기 (px). 기본 96 */
  size?: number;
};

export default function LoadingMascot({ label = '로딩 중...', src = '/mascot/mascot.png', size = 96 }: LoadingMascotProps) {
  const [imgOk, setImgOk] = React.useState(true);

  return (
    <div className="flex flex-col items-center text-purple-600 select-none">
      {imgOk ? (
        <img
          src={src}
          alt="loading mascot"
          width={size}
          height={size}
          loading="eager"          // 로딩 화면용이라 즉시
          decoding="async"
          className="drop-shadow-md"
          style={{
            animation: 'floatY 1.8s ease-in-out infinite',
          }}
          onError={() => setImgOk(false)}
        />
      ) : (
        <div
          aria-hidden
          className="text-6xl"
          style={{ animation: 'floatY 1.8s ease-in-out infinite' }}
        >
          🌊
        </div>
      )}
      <span className="mt-3 text-sm font-medium text-purple-700">{label}</span>

      <style>{`
        @keyframes floatY {
          0% { transform: translateY(0px) }
          50% { transform: translateY(-8px) }
          100% { transform: translateY(0px) }
        }
      `}</style>
    </div>
  );
}
