'use client';

import { motion } from 'framer-motion';
import { TestTube2, RefreshCcw, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export interface SkinDiagnosisProps {
  onBack?: () => void;
  onStart?: () => void; // 설문 실행
  onSkip?: () => void; // 나중에 하기
}

export default function SkinDiagnosis({ onBack, onStart, onSkip }: SkinDiagnosisProps) {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)',
      }}
    >
      <div className="w-full max-w-3xl bg-white/95 backdrop-blur-md shadow-xl rounded-3xl p-6 sm:p-10">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <TestTube2 className="w-7 h-7 text-purple-500" />
            바우만 피부타입 진단
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

        {/* 메인 설명 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          {/* 환영 메시지 */}
          <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-5 border border-pink-100">
            <p className="text-lg font-semibold text-gray-800 mb-2">
              반갑습니다! 🎉
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong className="text-purple-700">바우만 피부타입 진단</strong>은 세계적으로 인정받는 과학적 분석법으로, 
              당신의 피부를 16가지 유형 중 하나로 정확하게 분류합니다.
            </p>
          </div>

          {/* 왜 필요한가요? */}
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              왜 진단이 필요한가요?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">맞춤 제품 추천</p>
                  <p className="text-xs text-gray-600">피부 타입에 딱 맞는 화장품</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">개인화된 루틴</p>
                  <p className="text-xs text-gray-600">계절/시간대별 스킨케어</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">과학적 분석</p>
                  <p className="text-xs text-gray-600">지성/건성/민감도/색소/주름</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">AI 상담 강화</p>
                  <p className="text-xs text-gray-600">더 정확한 피부 고민 해결</p>
                </div>
              </div>
            </div>
          </div>

          {/* 진단 정보 */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-gray-700 text-sm leading-relaxed">
              <strong className="text-purple-600">12개 문항</strong> (필요 시 추가 1~4문항)의 간단한 설문으로
              <strong className="text-pink-600"> OD·SR·PN·WT</strong> 4가지 축을 분석합니다.
              소요시간은 약 <strong>3~5분</strong>이며, 결과는 즉시 대시보드와 프로필에 반영됩니다.
            </p>
          </div>
        </motion.div>

        {/* 버튼 영역 */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* 진단 시작 버튼 */}
          <motion.button
            onClick={onStart}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold shadow-lg hover:shadow-xl text-base transition-all w-full sm:w-auto"
            style={{
              background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCcw className="w-5 h-5" />
            진단 시작하기
          </motion.button>

          {/* 나중에 하기 버튼 */}
          {onSkip && (
            <button
              onClick={onSkip}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 text-base transition-all w-full sm:w-auto"
            >
              나중에 하기
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 하단 안내 */}
        <div className="mt-6 text-center text-sm text-gray-500">
          모든 데이터는 안전하게 저장되며,{' '}
          <span className="text-purple-600 font-medium">프로필 또는 설정 페이지</span>에서 언제든 다시 진단할 수 있습니다.
        </div>
      </div>
    </div>
  );
}