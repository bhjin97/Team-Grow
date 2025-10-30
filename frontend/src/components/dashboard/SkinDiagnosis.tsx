'use client';

import { motion } from 'framer-motion';
import { TestTube2, RefreshCcw } from 'lucide-react';

export interface SkinDiagnosisProps {
  onBack?: () => void;
  onStart?: () => void; // 설문 실행
}

export default function SkinDiagnosis({ onBack, onStart }: SkinDiagnosisProps) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)',
      }}
    >
      <div className="w-full max-w-3xl bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-6 sm:p-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <TestTube2 className="w-6 h-6 text-purple-500" />
            피부진단
          </h1>
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-white transition-colors"
            >
              돌아가기
            </button>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="leading-relaxed text-gray-700 text-base sm:text-lg"
        >
          <p>
            12문항(필요 시 추가 1~4문항)의 적응형 설문으로{' '}
            <strong className="text-purple-700">바우만 피부타입 (OD·SR·PN·WT)</strong>을 판정합니다.
          </p>
          <p className="mt-3">
            결과는 자동으로 <span className="font-semibold text-pink-600">프로필과 대시보드</span>에
            반영되어 루틴과 추천 서비스가 개인화됩니다.
          </p>
        </motion.div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold shadow-md hover:shadow-lg text-base transition-all"
            style={{
              background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
            }}
          >
            <RefreshCcw className="w-5 h-5" />
            진단 시작
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          모든 데이터는 보안 저장되며,{' '}
          <span className="text-purple-600 font-medium">언제든 다시 진단</span>할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
