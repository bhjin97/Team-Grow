'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Camera, Search, Loader2, AlertTriangle, X } from 'lucide-react';
import * as React from 'react';
import {
  fetchSimulation,
  fetchCategories,
  fetchProductsByCategory,
  fetchOcrAnalysis,
} from '../../lib/utils';
import Plot from 'react-plotly.js';

const KEYWORD_ENG_TO_KOR: Record<string, string> = {
  moisturizing: '보습',
  soothing: '진정',
  sebum_control: '피지',
  anti_aging: '주름',
  brightening: '미백',
  protection: '보호',
};

// [★] AnalysisResult 타입 확장: 사용자 주의 감지 필드 + score_before 등
interface AnalysisResult {
  final_score: number;
  score_before?: number;
  has_user_caution?: boolean;
  user_caution?: Array<{ korean_name: string }>;
  warning_message?: string | null;
  modal_variant?: 'danger' | null;

  product_info: {
    name: string;
    category: string;
    total_count: number;
    matched_count: number;
  };
  charts: {
    ratios: Record<string, number>;
    breakdown: Record<string, any>;
  };
  analysis: {
    good_points: string[];
    weak_points: string[];
    opinion: string;
  };
  ingredients: {
    matched: any[];
    unmatched: any[];
    caution: Array<{ korean_name: string; caution_grade: string }>;
  };
  /** ↓↓↓ 신뢰도 메타 (백엔드에서 이미 내려옴) ↓↓↓ */
  meta?: {
    reliability?: 'very_low' | 'low' | 'normal';
    total_keyword_hits?: number;
  };
}

// [★] 사용자 id를 프롭스로 전달받아 API에 넘긴다(없으면 undefined로 전송)
interface VirtualSkinModelProps {
  skinType: string;
  userId?: number;
}

// [신규] 점수별 색상 함수
const getScoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
};

const getScoreBgColor = (score: number) => {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 70) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
};

// Plotly gauge number에 적용할 헥스 색상
const getScoreHex = (score: number) => {
  if (score >= 80) return '#16a34a';
  if (score >= 70) return '#ca8a04';
  return '#dc2626';
};

// 저신뢰 툴팁 문구(기준 + 재촬영 팁)
const LOW_RELIABILITY_TIP =
  '저신뢰 기준: 매칭 성분 3~6개(소프트-패스) — 점수 캡(75) 적용\n' +
  '권장: 성분표를 정면·밝게·클로즈업으로 재촬영 후 재분석';

export default function VirtualSkinModel({ skinType, userId }: VirtualSkinModelProps) {
  // --- 상태 관리 (기존과 동일 + 주의 모달 상태 추가) ---
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showFullReport, setShowFullReport] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isListLoading, setIsListLoading] = useState(false);

  // [★] 내부에서 userId 로드(Fallback). 부모가 넘겨주지 않으면 프로필에서 가져옴.
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(false);

  // 부모 prop 우선, 없으면 프로필에서 로드한 id 사용
  const effectiveUserId = useMemo<number | null>(() => {
    if (typeof userId === 'number' && !Number.isNaN(userId)) return userId;
    if (typeof profileUserId === 'number' && !Number.isNaN(profileUserId)) return profileUserId;
    return null;
  }, [userId, profileUserId]);

  // [신규] OCR 관련 상태
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [isOcrMode, setIsOcrMode] = useState(false);

  // [신규] 사용자 주의 감지 모달
  const [showCautionModal, setShowCautionModal] = useState(false);

  // --- 데이터 로드 로직 (기존과 동일) ---
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (err) {
        console.error('카테고리 로드 실패:', err);
      }
    };
    loadCategories();
  }, []);
  // 프로필에서 userId 가져오기 (부모가 userId 안 준 경우에만)
  useEffect(() => {
    if (userId == null) {
      setIsUserLoading(true);
      (async () => {
        try {
          // 너희 서버 프로필 엔드포인트에 맞춰서 수정 가능
          const res = await fetch('/api/profile/1');
          if (res.ok) {
            const data = await res.json();
            const idNum = Number((data && (data.id ?? data.user_id)) ?? 1);
            setProfileUserId(Number.isNaN(idNum) ? 1 : idNum);
          } else {
            setProfileUserId(1); // 최소 동작 보장 (원한다면 제거 가능)
          }
        } catch {
          setProfileUserId(1);
        } finally {
          setIsUserLoading(false);
        }
      })();
    }
  }, [userId]);

  useEffect(() => {
    if (selectedCategory) {
      const loadProducts = async () => {
        setIsListLoading(true);
        setProducts([]);
        setSelectedProduct('');
        setAnalysisResult(null);
        try {
          const productList = await fetchProductsByCategory(selectedCategory);
          setProducts(productList.map((p: any) => p.product_name));
        } catch (err) {
          console.error('제품 목록 로드 실패:', err);
        } finally {
          setIsListLoading(false);
        }
      };
      loadProducts();
    } else {
      setProducts([]);
      setSelectedProduct('');
    }
  }, [selectedCategory]);

  // [신규] 이미지 업로드 핸들러
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSimError('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setUploadedImage(file);
    setIsOcrMode(true);
    setSimError(null);
    setAnalysisResult(null);

    setSelectedProduct('');
    setSelectedCategory('');
  };

  // [신규] OCR 분석 핸들러 (userId 전달)
  const handleOcrAnalysis = async () => {
    if (!uploadedImage) {
      setSimError('이미지를 먼저 업로드해주세요.');
      return;
    }

    setIsSimLoading(true);
    setSimError(null);
    setAnalysisResult(null);

    try {
      // [★] userId를 세 번째 인자로 전달 (utils가 해당 파라미터를 지원)
      const result = await fetchOcrAnalysis(uploadedImage, skinType, userId);
      setAnalysisResult(result);
      // [★] 사용자 주의 감지 시 경고 모달 자동 오픈
      if (result?.has_user_caution) setShowCautionModal(true);
    } catch (err) {
      if (err instanceof Error) setSimError(err.message);
      else setSimError('알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSimLoading(false);
    }
  };

  // --- API 호출 핸들러 (OCR 모드 분기 추가 + userId 전달) ---
  const handleSimulation = async () => {
    if (isOcrMode && uploadedImage) {
      await handleOcrAnalysis();
      return;
    }

    if (!selectedProduct) {
      setSimError('제품을 선택하거나 이미지를 업로드해주세요.');
      return;
    }
    setIsSimLoading(true);
    setSimError(null);
    setAnalysisResult(null);
    try {
      // [★] userId를 세 번째 인자로 전달 (utils가 해당 파라미터를 지원)
      const result = await fetchSimulation(selectedProduct, skinType, userId);
      setAnalysisResult(result);
      // [★] 사용자 주의 감지 시 경고 모달 자동 오픈
      if (result?.has_user_caution) setShowCautionModal(true);
    } catch (err) {
      if (err instanceof Error) setSimError(err.message);
      else setSimError('알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSimLoading(false);
    }
  };

  // --- 차트 데이터/레이아웃 생성 (기존과 동일) ---
  const getChartData = () => {
    if (!analysisResult) return null;
    const commonLayout = {
      font: { family: 'Pretendard, sans-serif', size: 12, color: '#333' },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 50, b: 50, l: 50, r: 50 },
      hovermode: 'closest',
      title: { font: { size: 18, color: '#333' }, x: 0.5, xanchor: 'center' },
    };
    const gaugeData = [
      {
        type: 'indicator',
        mode: 'gauge+number',
        value: analysisResult.final_score,
        title: { text: '적합도 점수', font: { size: 16, color: '#4a4a4a' } },
        gauge: {
          axis: { range: [0, 100], tickwidth: 0 },
          bar: { color: '#e8b4d4', line: { width: 1, color: '#f5c6d9' } },
          bgcolor: 'white',
          borderwidth: 0,
          steps: [],
          threshold: {
            line: { color: 'red', width: 4 },
            thickness: 0.75,
            value: analysisResult.final_score,
          },
        },
        number: { font: { size: 64, color: getScoreHex(analysisResult.final_score) }, suffix: '' },
      },
    ];
    const breakdownData = Object.entries(analysisResult.charts.breakdown)
      .map(([engKey, data]) => ({
        key: KEYWORD_ENG_TO_KOR[engKey] || engKey,
        contribution: (data as any).contribution,
      }))
      .sort((a, b) => a.contribution - b.contribution);
    const barData = [
      {
        type: 'bar',
        x: breakdownData.map(d => d.contribution),
        y: breakdownData.map(d => d.key),
        orientation: 'h',
        marker: { color: '#e8b4d4' },
        text: breakdownData.map(d => d.contribution.toFixed(2)),
        textposition: 'outside',
        textfont: { color: '#4a4a4a' },
      },
    ];
    const barLayout = {
      ...commonLayout,
      title: { text: '키워드별 점수 기여도', font: { size: 18, color: '#333' } },
      height: 300,
      margin: { t: 50, b: 40, l: 80, r: 20 },
      xaxis: {
        title: { text: '기여도', font: { size: 14, color: '#4a4a4a' } },
        showgrid: true,
        gridcolor: '#f0f0f0',
      },
      yaxis: { automargin: true, tickfont: { size: 12, color: '#4a4a4a' } },
      bargap: 0.3,
    };
    const pieDataRaw = Object.entries(analysisResult.charts.ratios).filter(
      ([, value]) => value > 0
    );
    const pieData = [
      {
        type: 'pie',
        labels: pieDataRaw.map(([key]) => KEYWORD_ENG_TO_KOR[key] || key),
        values: pieDataRaw.map(([, value]) => value),
        hole: 0.4,
        textposition: 'inside',
        textinfo: 'percent+label',
        marker: { colors: ['#f5c6d9', '#e8b4d4', '#d0a2cc', '#b890c5', '#a07ebf', '#886dbe'] },
        hoverinfo: 'label+percent+value',
        insidetextfont: { color: '#fff', size: 11 },
      },
    ];
    const pieLayout = {
      ...commonLayout,
      title: { text: '키워드별 성분 비율', font: { size: 18, color: '#333' } },
      height: 400,
      margin: { t: 50, b: 50, l: 50, r: 50 },
    };
    return {
      gaugeData,
      gaugeLayout: {
        ...commonLayout,
        height: 300,
        margin: { t: 50, b: 0, l: 30, r: 30 },
        title: { text: '종합 점수', font: { size: 18, color: '#333' } },
      },
      barData,
      barLayout,
      pieData,
      pieLayout,
    };
  };

  const chartData = getChartData();

  // 백엔드가 opinion 앞에 저신뢰 경고를 붙이는 경우가 있어 배너와 중복되지 않게 제거
  const cleanOpinion = useMemo(() => {
    const txt = analysisResult?.analysis?.opinion || '';
    return txt.replace(/^⚠️ \*\*저신뢰 분석\*\*:.*?\n\n/s, '');
  }, [analysisResult]);

  // [★] 사용자 주의 모달 닫기 핸들러
  const closeCautionModal = () => setShowCautionModal(false);

  // --- 메인 UI 렌더링 ---
  return (
    <>
      {/* --- 1. 대시보드 카드 UI (기존과 동일) --- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
      >
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
          <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mr-2" />
          가상 피부 시뮬레이션
        </h3>

        {/* '얼굴 모델' 영역 */}
        <div className="h-48 sm:h-56 bg-purple-50 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden p-4">
          {isSimLoading && (
            <div className="flex flex-col items-center text-purple-600">
              <Loader2 className="w-12 h-12 animate-spin" />
              <span className="mt-3 text-sm font-medium">분석 중입니다...</span>
            </div>
          )}

          {!isSimLoading && simError && (
            <div className="flex flex-col items-center text-red-600 text-center">
              <AlertTriangle className="w-12 h-12 mb-2" />
              <span className="text-sm font-semibold">오류 발생</span>
              <span className="text-xs mt-1">{simError}</span>
            </div>
          )}

          {!isSimLoading && analysisResult && (
            <div className="flex flex-col items-center text-center">
              <span className="text-sm text-gray-600">{analysisResult.product_info.name}</span>
              <span className="text-xs text-gray-500 mb-2">({skinType} 타입 기준)</span>

              {/* [★] 사용자 주의 경고 배지 (상단 소형) */}
              {analysisResult?.has_user_caution && (
                <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[12px] inline-flex items-center gap-1 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{analysisResult.warning_message || '선택하신 주의 성분이 포함되어 있습니다.'}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* [★] 이전 점수(취소선) + 최종 점수 이중 표기 */}
                {analysisResult?.has_user_caution && typeof analysisResult?.score_before === 'number' && (
                  <span className="text-2xl font-semibold text-gray-400 line-through">
                    {analysisResult.score_before}
                  </span>
                )}
                <span className={`text-7xl font-bold ${getScoreColor(analysisResult.final_score)}`}>
                  {analysisResult.final_score}
                </span>
                {analysisResult?.meta?.reliability === 'low' && (
                  <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-[11px] font-medium">
                    저신뢰
                  </span>
                )}
              </div>

              <span className="text-lg font-medium text-gray-700">/ 100점</span>
            </div>
          )}

          {!isSimLoading && !simError && !analysisResult && (
            <div className="text-center text-gray-500">
              <span className="text-sm sm:text-base font-medium">
                카테고리를 선택하고 제품을 분석하세요.
              </span>
              <Search className="w-10 h-10 mx-auto mt-2 opacity-30" />
            </div>
          )}
        </div>

        {/* 버튼 영역 */}
        <div className="space-y-2">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base"
          >
            <option value="">📂 카테고리 선택...</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {selectedCategory && (
            <select
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              disabled={isListLoading}
              className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base"
            >
              <option value="">{isListLoading ? '제품 로딩 중...' : '🧴 제품 선택...'}</option>
              {products.map(prodName => (
                <option key={prodName} value={prodName}>
                  {prodName}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <input
              type="text"
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              placeholder="또는 제품명 직접 검색/입력"
              className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base"
            />
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">또는</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* 이미지 업로드 */}
          <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-pink-300 text-center cursor-pointer hover:bg-pink-100 hover:border-pink-400 transition-all">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <span className="text-pink-700 font-medium text-sm">📸 이미지 업로드 (OCR)</span>
          </label>

          {/* 업로드 미리보기 */}
          {uploadedImage && (
            <div className="p-3 bg-purple-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-purple-700 font-medium">✅ {uploadedImage.name}</span>
                <span className="text-xs text-purple-500">
                  ({(uploadedImage.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={() => {
                  setUploadedImage(null);
                  setIsOcrMode(false);
                  setSimError(null);
                }}
                className="text-purple-400 hover:text-purple-600"
              >
                ✕
              </button>
            </div>
          )}

          <button
            onClick={handleSimulation}
            disabled={isSimLoading || (!selectedProduct && !uploadedImage)}
            className="w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl bg-pink-100 text-pink-700 text-sm sm:text-base font-medium hover:bg-pink-200 transistion-color"
          >
            {isSimLoading
              ? '분석 중...'
              : isOcrMode
              ? '🔍 이미지 분석 시작'
              : '제품 효과 시뮬레이션'}
          </button>

          {analysisResult && (
            <button
              onClick={() => setShowFullReport(true)}
              className="w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl bg-purple-100 text-purple-700 text-sm sm:text-base font-medium hover:bg-purple-200 transistion-color"
            >
              결과 전체보기 (장/단점, 성분표)
            </button>
          )}
        </div>
      </motion.div>

      {/* --- 2. 전체보기 모달 --- */}
      {showFullReport && analysisResult && chartData && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullReport(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-6xl max-h-[95vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {analysisResult?.meta?.reliability === 'low' && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <span className="font-semibold">저신뢰 분석</span>: OCR 매칭 성분이 적어 결과가
                    부정확할 수 있습니다. 성분표를{' '}
                    <span className="underline underline-offset-2">정면·밝게·클로즈업</span>으로
                    재촬영해 재분석을 권장합니다.
                    {typeof analysisResult?.meta?.total_keyword_hits === 'number' && (
                      <span className="ml-2 text-xs text-gray-600">
                        (매칭 개수: {analysisResult.meta.total_keyword_hits})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-yellow-300 bg-yellow-100 text-[12px] leading-none"
                    title={LOW_RELIABILITY_TIP}
                    aria-label="저신뢰 기준 및 촬영 팁"
                  >
                    ?
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-8">
              {/* 1. 제품 정보 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">제품명</p>
                  <p
                    className="text-lg font-semibold text-gray-900 truncate"
                    title={analysisResult.product_info.name}
                  >
                    {analysisResult.product_info.name}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">카테고리</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analysisResult.product_info.category}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">총 성분</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analysisResult.product_info.total_count}개
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">고유 매칭 성분</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {analysisResult.product_info.matched_count}개
                  </p>
                </div>
              </div>

              {/* 2. 시각화 */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">시각화</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="border rounded-lg p-2 md:col-span-2">
                    <Plot
                      data={chartData.gaugeData}
                      layout={chartData.gaugeLayout}
                      useResizeHandler={true}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="border rounded-lg p-2 md:col-span-3">
                    <Plot
                      data={chartData.barData}
                      layout={chartData.barLayout}
                      useResizeHandler={true}
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <div className="border rounded-lg p-2">
                  <Plot
                    data={chartData.pieData}
                    layout={chartData.pieLayout}
                    useResizeHandler={true}
                    className="w-full"
                  />
                </div>
              </div>

              {/* 3. 성분 상세 */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">성분 상세</h3>
                <div>
                  <h4 className="text-lg font-semibold">
                    📋 매칭된 성분 ({analysisResult.ingredients.matched.length}개 키워드 히트)
                  </h4>
                  <div className="max-h-64 overflow-y-auto border rounded-lg mt-2">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                        <tr>
                          <th scope="col" className="px-6 py-3">성분명</th>
                          <th scope="col" className="px-6 py-3">배합목적 (추정)</th>
                          <th scope="col" className="px-6 py-3">매칭 효능</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.ingredients.matched.map((item, i) => (
                          <tr className="bg-white border-b" key={i}>
                            <td className="px-6 py-4 font-medium text-gray-900">{item.성분명}</td>
                            <td className="px-6 py-4">{item.배합목적}</td>
                            <td className="px-6 py-4">{item.효능}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {analysisResult.ingredients.unmatched.length > 0 && (
                  <details>
                    <summary className="text-md font-semibold cursor-pointer text-gray-700 hover:text-black">
                      📋 6대 키워드 미매칭 성분 ({analysisResult.ingredients.unmatched.length}개)
                    </summary>
                    <div className="p-4 bg-gray-50 rounded-lg mt-2">
                      <p className="text-sm text-gray-600 mb-2">
                        이 성분들은 6대 키워드(보습/진정/피지/주름/미백/보호)에 해당하지 않아 점수 계산에서 제외되었습니다.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.ingredients.unmatched.map((item, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700"
                          >
                            {item.성분명}
                          </span>
                        ))}
                      </div>
                    </div>
                  </details>
                )}

                {/* [★] 시스템 주의 성분 테이블 (기존 섹션 유지) */}
                {analysisResult.ingredients.caution &&
                  analysisResult.ingredients.caution.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-lg font-semibold text-red-600 mb-2">
                        ⚠️ 주의 성분 ({analysisResult.ingredients.caution.length}개)
                      </h4>
                      <div className="border border-red-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-red-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-red-900 font-semibold">성분명</th>
                              <th scope="col" className="px-6 py-3 text-red-900 font-semibold">주의 등급</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisResult.ingredients.caution.map((item, i) => (
                              <tr className="bg-white border-b border-red-100" key={i}>
                                <td className="px-6 py-4 font-medium text-gray-900">{item.korean_name}</td>
                                <td className="px-6 py-4">
                                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                                    {item.caution_grade}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
              </div>

              {/* 4. 분석 근거 */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">분석 근거</h3>
                <div>
                  <h4 className="text-lg font-semibold mb-2">📖 용어 설명</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <strong>적합도 (Fit Score)</strong>
                      <p>제품의 성분 비율이 피부타입의 목표 범위에 얼마나 적합한지를 나타냅니다. (0~1.0)</p>
                    </div>
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <strong>중요도 (Importance)</strong>
                      <p>해당 효능이 피부타입에 얼마나 중요한지를 나타냅니다. (-1~2)</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg mt-3 text-sm">
                    <strong>기여도 (Contribution)</strong>
                    <p>적합도 × 중요도 = 최종 점수에 기여하는 정도입니다. 양수는 가산점, 음수는 감점입니다.</p>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">🧮 점수 계산 방식</h4>
                  <div className="p-4 bg-gray-100 rounded-lg text-sm">
                    <pre className="whitespace-pre-wrap font-sans">
{`1. 각 키워드별 비율 계산
   비율 = (키워드 성분 수 / 총 키워드 히트 수) × 100

2. 적합도 계산
   - 타겟 범위 내: 1.0
   - 타겟 범위 미달: 비율에 따라 선형 감소
   - 타겟 범위 초과: 가혹한 페널티

3. 기여도 계산
   기여도 = 적합도 × 중요도

4. 최종 점수
   점수 = 베이스 점수(25) + Σ(기여도) 정규화 (0~100)`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* 5. 최종 분석 결과 */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">📝 최종 분석 결과</h3>
                <div>
                  <h4 className="text-lg font-semibold text-green-600">✅ 장점</h4>
                  <ul className="list-disc list-inside text-sm pl-2">
                    {analysisResult.analysis.good_points.map((point, i) => (
                      <li key={i}>{point.replace(/\*\*/g, '')}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-orange-600">⚠️ 개선 필요</h4>
                  <ul className="list-disc list-inside text-sm pl-2">
                    {analysisResult.analysis.weak_points.map((point, i) => (
                      <li key={i}>{point.replace(/\*\*/g, '')}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">💡 종합 의견</h4>
                  <div className={`p-4 rounded-lg border-2 ${getScoreBgColor(analysisResult.final_score)}`}>
                    {/* [★] 사용자 주의 경고 배지(요약 영역에도 고정 노출) */}
                    {analysisResult?.has_user_caution && (
                      <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[12px] text-red-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{analysisResult.warning_message || '선택하신 주의 성분이 포함되어 있습니다.'}</span>
                      </div>
                    )}
                    <p className="text-base font-medium leading-relaxed">
                      {cleanOpinion.replace(/\*\*/g, '')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 모달 닫기 버튼 */}
            <button
              onClick={() => setShowFullReport(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="닫기"
              title="닫기"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* --- 3. [★신규] 사용자 주의 성분 경고 모달 --- */}
      {analysisResult?.has_user_caution && showCautionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border-2 border-red-300 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-red-600 text-white">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-base font-semibold">주의 성분 감지됨</h4>
              </div>
              <button onClick={closeCautionModal} aria-label="닫기">
                <X className="w-5 h-5 text-white/90 hover:text-white" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-800 mb-3">
                {analysisResult.warning_message || '선택하신 주의 성분이 포함되어 있습니다.'}
              </p>

              {/* [★] 감점 설명 + 점수 이중 표기 */}
              <div className="mb-3">
                <p className="text-sm text-gray-700">
                  적용 정책: 사용자 주의 성분 발견 시 <span className="font-semibold text-red-600">즉시 -40점</span> 감점
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  {typeof analysisResult.score_before === 'number' && (
                    <span className="text-lg font-semibold text-gray-400 line-through">
                      {analysisResult.score_before}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-red-600">{analysisResult.final_score}</span>
                  <span className="text-sm text-gray-600">/ 100점</span>
                </div>
              </div>

              {/* [★] 사용자 주의 성분 목록 (최대 5개 + 축약) */}
              {Array.isArray(analysisResult.user_caution) && analysisResult.user_caution.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-gray-800 mb-1">감지된 사용자 주의 성분</p>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.user_caution.slice(0, 5).map((u, idx) => (
                      <span key={`${u.korean_name}-${idx}`} className="px-2 py-1 rounded-full border border-red-200 bg-red-50 text-red-700 text-xs">
                        {u.korean_name}
                      </span>
                    ))}
                    {analysisResult.user_caution.length > 5 && (
                      <span className="text-xs text-gray-600">
                        외 {analysisResult.user_caution.length - 5}개
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-gray-50 flex items-center justify-end gap-2">
              <button
                onClick={closeCautionModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
              >
                확인
              </button>
              <button
                onClick={() => {
                  closeCautionModal();
                  setShowFullReport(true);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm"
              >
                자세히 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
