'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Camera, Search, AlertTriangle, X, Sparkles, Check } from 'lucide-react';
import * as React from 'react';
import {
  fetchSimulation,
  fetchCategories,
  fetchProductsByCategory,
  fetchOcrAnalysis,
  fetchTopProductsByCategory, // ★ 상위 추천 API
  fetchFavoriteProducts,
} from '../../lib/utils';
import Plot from 'react-plotly.js';
import LoadingMascot from '../common/LoadingMascot';

const KEYWORD_ENG_TO_KOR: Record<string, string> = {
  moisturizing: '보습',
  soothing: '진정',
  sebum_control: '피지',
  anti_aging: '주름',
  brightening: '미백',
  protection: '보호',
};

// ===================== Types =====================
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
  meta?: {
    reliability?: 'very_low' | 'low' | 'normal';
    total_keyword_hits?: number;
  };
}

interface TopProductItem {
  product_name: string;
  category: string;
  final_score: number;
  score_before?: number;
  has_user_caution?: boolean;
  user_caution?: Array<{ korean_name: string }>;
  matched_count?: number;
  total_keyword_hits?: number;
  reliability?: 'very_low' | 'low' | 'normal';
}

interface VirtualSkinModelProps {
  skinType: string;
  userId?: number;
}
// ★ 안전한 userId 헬퍼 (undefined/null이면 localStorage → 최종 1 fallback)
const getUid = (explicit?: number) => {
  const fromLS = Number(localStorage.getItem('user_id') || '1');
  const primary = explicit ?? fromLS;
  return Number.isFinite(primary as number) && (primary as number) > 0 ? (primary as number) : 1;
};

// ===================== Helpers =====================
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

const getScoreHex = (score: number) => {
  if (score >= 80) return '#16a34a';
  if (score >= 70) return '#ca8a04';
  return '#dc2626';
};

const LOW_RELIABILITY_TIP =
  '저신뢰 기준: 매칭 성분 3~6개(소프트-패스) — 점수 캡(75) 적용\n' +
  '권장: 성분표를 정면·밝게·클로즈업으로 재촬영 후 재분석';

// ===================== Component =====================
export default function VirtualSkinModel({ skinType, userId }: VirtualSkinModelProps) {
  // --- 분석/선택 상태 ---
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  // --- 기본 목록 ---
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [isListLoading, setIsListLoading] = useState(false);

  // --- OCR ---
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [isOcrMode, setIsOcrMode] = useState(false);

  // --- 사용자 주의 모달 ---
  const [showCautionModal, setShowCautionModal] = useState(false);

  // --- 상위 추천 탭 / 데이터 ---
  const [showFullReport, setShowFullReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'top' | 'all' | 'fav'>('top');
  const [topList, setTopList] = useState<TopProductItem[]>([]);
  const [isTopLoading, setIsTopLoading] = useState(false);
  const [topSelected, setTopSelected] = useState<string[]>([]); // product_name 배열(최대 4)
  const [favoriteProducts, setFavoriteProducts] = useState<string[]>([]);
  const [isFavLoading, setIsFavLoading] = useState(false);

  // ========== 초기 로드 ==========
  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (err) {
        console.error('카테고리 로드 실패:', err);
      }
    })();
  }, []);

  // ========== 카테고리 변경 시 제품 목록 ==========
  useEffect(() => {
    setTopSelected([]);
    setTopList([]);
    setSelectedProduct('');
    setAnalysisResult(null);

    if (!selectedCategory) {
      setProducts([]);
      return;
    }
    (async () => {
      setIsListLoading(true);
      try {
        const list = await fetchProductsByCategory(selectedCategory);
        setProducts(list.map((p: any) => p.product_name));
      } catch (err) {
        console.error('제품 목록 로드 실패:', err);
      } finally {
        setIsListLoading(false);
      }
    })();
  }, [selectedCategory]);

  // ========== 카테고리/피부타입 준비되면 상위 추천 불러오기 ==========
  useEffect(() => {
    if (!selectedCategory || !skinType) return;
    setIsTopLoading(true);
    const uid = getUid(userId);
    fetchTopProductsByCategory(selectedCategory, skinType, uid, 4)
      .then(items => {
        const sorted = [...items].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0));
        setTopList(sorted);
      })
      .catch(e => {
        console.error('[TOP] load error', e);
        setTopList([]);
      })
      .finally(() => setIsTopLoading(false));
  }, [selectedCategory, skinType, userId]);

  useEffect(() => {
    if (activeTab !== 'fav') return;

    const uid = getUid(userId);
    if (!uid) return;

    setIsFavLoading(true);
    setFavoriteProducts([]);
    setSelectedProduct('');
    setTopSelected([]);
    setIsOcrMode(false);
    setUploadedImage(null);
    setAnalysisResult(null);

    fetchFavoriteProducts(uid)
      .then(list => {
        setFavoriteProducts(list.map((p: any) => p.product_name));
      })
      .catch(err => {
        console.error('즐겨찾기 제품 로드 실패:', err);
        setFavoriteProducts([]);
      })
      .finally(() => setIsFavLoading(false));
  }, [activeTab, userId]);

  // ========== 이미지 업로드 ==========
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
  };

  const handleOcrAnalysis = async () => {
    if (!uploadedImage) {
      setSimError('이미지를 먼저 업로드해주세요.');
      return;
    }
    setIsSimLoading(true);
    setSimError(null);
    setAnalysisResult(null);
    try {
      const uid = getUid(userId);
      const result = await fetchOcrAnalysis(uploadedImage, skinType, uid);
      setAnalysisResult(result);
      if (result?.has_user_caution) setShowCautionModal(true);
    } catch (err) {
      if (err instanceof Error) setSimError(err.message);
      else setSimError('알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSimLoading(false);
    }
  };

  // ========== 분석 실행 ==========
  const handleSimulation = async () => {
    // OCR
    if (isOcrMode && uploadedImage) {
      await handleOcrAnalysis();
      return;
    }

    // 상위 추천에서 다중 선택 -> 정확히 1개만 허용하여 분석
    const effectiveSelected = topSelected.length === 1 ? topSelected[0] : selectedProduct;

    if (!effectiveSelected) {
      setSimError(
        topSelected.length > 1
          ? '분석은 1개 제품만 가능합니다. 선택을 1개로 줄여주세요.'
          : '제품을 선택하거나 이미지를 업로드해주세요.'
      );
      return;
    }

    setIsSimLoading(true);
    setSimError(null);
    setAnalysisResult(null);
    try {
      const uid = getUid(userId);
      const result = await fetchSimulation(effectiveSelected, skinType, uid);
      setAnalysisResult(result);
      if (result?.has_user_caution) setShowCautionModal(true);
    } catch (err) {
      if (err instanceof Error) setSimError(err.message);
      else setSimError('알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSimLoading(false);
    }
  };

  // ========== 차트 ==========
  const getChartData = () => {
    if (!analysisResult) return null;
    const commonLayout = {
      font: { family: 'Pretendard, sans-serif', size: 12, color: '#333' },
      plot_bgcolor: 'rgba(0,0,0,0)',
      paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 50, b: 50, l: 50, r: 50 },
      hovermode: 'closest' as const,
      title: { font: { size: 18, color: '#333' }, x: 0.5, xanchor: 'center' as const },
    };
    const gaugeData = [
      {
        type: 'indicator',
        mode: 'gauge+number',
        value: analysisResult.final_score,
        title: { text: '적합도 점수', font: { size: 16, color: '#4a4a4a' } },
        gauge: {
          axis: { range: [0, 100], tickwidth: 0 },
          bar: { color: '#f4acb7', line: { width: 1, color: '#f5c6d9' } },
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
        orientation: 'h' as const,
        marker: { color: breakdownData.map((_, i) => ['#d8e2dc', '#e8e8e4', '#f8edeb','#fae1dd', '#fcd5ce', '#fec5bb'][i % 6]) },
        text: breakdownData.map(d => d.contribution.toFixed(2)),
        textposition: 'outside' as const,
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
        textposition: 'inside' as const,
        textinfo: 'percent+label' as const,
        marker: { colors: ['#bef3d1ff', '#fec5bb', '#fcefb4','#efcfe3', '#ccc9dc', '#b9d6f2'] },
        hoverinfo: 'label+percent+value' as const,
        insidetextfont: { color: '#737373', size: 15, weight: 'bold'},
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

  const cleanOpinion = useMemo(() => {
    const txt = analysisResult?.analysis?.opinion || '';
    return txt.replace(/^⚠️ \*\*저신뢰 분석\*\*:.*?\n\n/s, '');
  }, [analysisResult]);

  const closeCautionModal = () => setShowCautionModal(false);

  // ========== 상위 추천 카드 렌더 ==========
  const toggleTopSelect = (name: string) => {
    setSimError(null);
    setSelectedProduct('');
    setIsOcrMode(false);
    setUploadedImage(null);
    setAnalysisResult(null);

    setTopSelected(prev => {
      const has = prev.includes(name);
      if (has) return prev.filter(n => n !== name);
      if (prev.length >= 4) return prev; // 최대 4개
      return [...prev, name];
    });
  };

  const SelectedHint = () => (
    <div className="text-xs text-gray-500 mt-1">
      {topSelected.length === 0 && '최대 4개까지 선택해 빠른 비교가 가능합니다.'}
      {topSelected.length === 1 && '궁금한 제품을 클릭해 성분까지 확인하세요.'}
      {topSelected.length > 1 && '여러 개 선택됨(비교용). 상세 분석은 1개만 선택해야 합니다.'}
    </div>
  );

  // ===================== UI =====================
  return (
    <>
      {/* --- 1. 카드 --- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
      >
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 flex items-center">
          <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mr-2" />내 피부에 딱 맞는
          제품일까?
        </h3>

        {/* 프리뷰 캔버스 */}
        <div className="h-48 sm:h-56 bg-purple-50 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden p-4">
          {isSimLoading && <LoadingMascot label="분석 중입니다..." src="/mascot/mascot.png" />}

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
              <span className="text-xs text-gray-500 mb-2">(내 피부 타입 {skinType} 기준)</span>

              {analysisResult?.has_user_caution && (
                <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[12px] inline-flex items-center gap-1 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    {analysisResult.warning_message || '선택하신 주의 성분이 포함되어 있습니다.'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3">
                {analysisResult?.has_user_caution &&
                  typeof analysisResult?.score_before === 'number' && (
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
                궁금한 제품의 카테고리를 선택해주세요
              </span>
              <Search className="w-10 h-10 mx-auto mt-2 opacity-30" />
            </div>
          )}
        </div>

        {/* 선택 영역 */}
        <div className="space-y-2">
          {/* 카테고리 */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base"
          >
            <option value="">📁 어떤 제품을 찾으세요?</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* 탭 */}
          <div className="mt-2 flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                activeTab === 'top'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('top')}
              type="button"
            >
              이 카테고리 BEST 추천
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                activeTab === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('all')}
              type="button"
            >
              모두 보기
            </button>
            {/*즐겨찾기 탭 버튼 */}
            <button
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                activeTab === 'fav'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setActiveTab('fav')}
              type="button"
            >
              즐겨찾기 제품 보기
            </button>
          </div>

          {/* 탭 콘텐츠 */}
          {activeTab === 'top' ? (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">이 카테고리 BEST 추천</p>
                <span className="text-[11px] text-gray-400">{Math.min(topList.length, 4)}개</span>
              </div>

              <div className="rounded-xl border bg-white">
                {isTopLoading ? (
                  <div className="p-4">
                    <LoadingMascot label="BEST 추천 계산 중..." src="/mascot/mascot.png" />
                  </div>
                ) : topList.length === 0 ? (
                  <div className="p-4 text-sm text-gray-600">
                    이 카테고리에는 분석 가능한 제품이 없어요 😢
                    <ul className="mt-2 list-disc list-inside text-xs text-gray-500">
                      <li>💡 이렇게 해보세요.</li>
                      <li>- 다른 카테고리에서 찾아보기</li>
                      <li>- 제품 사진으로 바로 검색하기</li>
                    </ul>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                      {topList.slice(0, 4).map(item => {
                        const selected = topSelected.includes(item.product_name);
                        const badge = item.has_user_caution ? (
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                            주의 성분
                          </span>
                        ) : null;
                        const low =
                          item.reliability === 'low' ? (
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200">
                              저신뢰
                            </span>
                          ) : null;

                        return (
                          <button
                            key={item.product_name}
                            type="button"
                            onClick={() => toggleTopSelect(item.product_name)}
                            className={`text-left rounded-xl border p-3 transition ${
                              selected
                                ? 'border-purple-400 ring-2 ring-purple-200 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm font-semibold text-gray-900 truncate">
                                    {item.product_name}
                                  </span>
                                  {badge}
                                  {low}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {item.category}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                <span
                                  className={`text-base font-bold ${getScoreColor(item.final_score)}`}
                                >
                                  {item.final_score}
                                </span>
                              </div>
                            </div>
                            {selected && (
                              <div className="mt-2 inline-flex items-center gap-1 text-xs text-purple-700">
                                <Check className="w-4 h-4" />
                                선택됨
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="px-3 pb-3">
                      <SelectedHint />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : activeTab === 'all' ? (
            // 전체 목록 탭
            <div className="space-y-2 mt-2">
              <select
                value={selectedProduct}
                onChange={e => {
                  setSelectedProduct(e.target.value);
                  setTopSelected([]);
                }}
                disabled={isListLoading || !selectedCategory}
                className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base"
              >
                <option value="">
                  {isListLoading
                    ? '제품 로딩 중...'
                    : selectedCategory
                      ? '📌 제품을 골라주세요'
                      : '카테고리를 먼저 선택'}
                </option>
                {products.map(prodName => (
                  <option key={prodName} value={prodName}>
                    {prodName}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-500">위에서 제품 하나를 골라주세요.</div>
            </div>
          ) : (
            // 즐겨찾기 탭
            <div className="space-y-2 mt-2">
              <p className="text-sm font-semibold">⭐ 즐겨찾기한 제품</p>

              {isFavLoading ? (
                <div className="p-4 rounded-xl border bg-white">
                  <LoadingMascot label="즐겨찾기 제품 불러오는 중..." src="/mascot/mascot.png" />
                </div>
              ) : favoriteProducts.length === 0 ? (
                <div className="p-4 rounded-xl border bg-white text-sm text-gray-600">
                  즐겨찾기한 제품이 아직 없어요.
                  <div className="mt-1 text-xs text-gray-500">
                    제품 카드에서 즐겨찾기를 추가하면 여기에서 바로 선택하여 분석할 수 있어요.
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    {favoriteProducts.map(name => {
                      const selected = selectedProduct === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setSelectedProduct(
                              prev => (prev === name ? '' : name) // ← 같으면 취소, 다르면 선택
                            );
                            setTopSelected([]);
                            setIsOcrMode(false);
                            setUploadedImage(null);
                            setAnalysisResult(null);
                            setSimError(null);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition ${
                            selected
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-purple-50 hover:border-purple-300'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    한 개를 선택하면 아래에서 바로{' '}
                    <span className="font-semibold">내 피부 적합도 분석</span> 버튼으로 분석할 수
                    있어요.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 구분선 */}
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-500">또는</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* 이미지 업로드 */}
          <label className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-pink-300 text-center cursor-pointer hover:bg-pink-100 hover:border-pink-400 transition-all">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <span className="text-pink-700 font-medium text-sm">📷 제품 사진으로 찾기 (OCR)</span>
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

          {/* 실행 버튼 (여러 선택 시 비활성화) */}
          <button
            onClick={handleSimulation}
            disabled={
              isSimLoading ||
              (!uploadedImage && !selectedProduct && topSelected.length === 0) ||
              topSelected.length > 1 // 분석은 1개만
            }
            className={`w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl text-sm sm:text-base font-medium transistion-color ${
              topSelected.length > 1
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
            }`}
          >
            {isSimLoading
              ? '분석 중...'
              : isOcrMode
                ? '🔍 이미지 분석 시작'
                : topSelected.length === 1
                  ? 'BEST 제품 비교 분석'
                  : '내 피부 적합도 분석'}
          </button>
          {analysisResult && (
            <button
              onClick={() => setShowFullReport(true)}
              className="w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl bg-purple-100 text-purple-700 text-sm sm:text-base font-medium hover:bg-purple-200 transistion-color"
            >
              전체 결과 + 장단점 보기
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
            className="bg-white rounded-2xl p-6 w-full max-w-6xl max-h-[95vh] overflow-y-auto relative"
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
                <div className="bg-gray-50 p-4 p-4 rounded-lg text-center shadow-sm">
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
                          <th scope="col" className="px-6 py-3">
                            성분명
                          </th>
                          <th scope="col" className="px-6 py-3">
                            배합목적 (추정)
                          </th>
                          <th scope="col" className="px-6 py-3">
                            매칭 효능
                          </th>
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
                        이 성분들은 6대 키워드(보습/진정/피지/주름/미백/보호)에 해당하지 않아 점수
                        계산에서 제외되었습니다.
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
                              <th scope="col" className="px-6 py-3 text-red-900 font-semibold">
                                성분명
                              </th>
                              <th scope="col" className="px-6 py-3 text-red-900 font-semibold">
                                주의 등급
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysisResult.ingredients.caution.map((item, i) => (
                              <tr className="bg-white border-b border-red-100" key={i}>
                                <td className="px-6 py-4 font-medium text-gray-900">
                                  {item.korean_name}
                                </td>
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
                      <p>
                        제품의 성분 비율이 피부타입의 목표 범위에 얼마나 적합한지를 나타냅니다.
                        (0~1.0)
                      </p>
                    </div>
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <strong>중요도 (Importance)</strong>
                      <p>해당 효능이 피부타입에 얼마나 중요한지를 나타냅니다. (-1~2)</p>
                    </div>
                  </div>
                  <div className="p-3 bg-gray-100 rounded-lg mt-3 text-sm">
                    <strong>기여도 (Contribution)</strong>
                    <p>
                      적합도 × 중요도 = 최종 점수에 기여하는 정도입니다. 양수는 가산점, 음수는
                      감점입니다.
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">🧮 점수 계산 방식</h4>
                  <div className="p-4 bg-gray-100 rounded-lg text-sm">
                    <pre className="whitespace-pre-wrap font-sans">{`1. 각 키워드별 비율 계산
   비율 = (키워드 성분 수 / 총 키워드 히트 수) × 100

2. 적합도 계산
   - 타겟 범위 내: 1.0
   - 타겟 범위 미달: 비율에 따라 선형 감소
   - 타겟 범위 초과: 가혹한 페널티

3. 기여도 계산
   기여도 = 적합도 × 중요도

4. 최종 점수
   점수 = 베이스 점수(25) + Σ(기여도) 정규화 (0~100)`}</pre>
                  </div>
                </div>
              </div>

              {/* 5. 종합 의견 */}
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
                  <div
                    className={`p-4 rounded-lg border-2 ${getScoreBgColor(analysisResult.final_score)}`}
                  >
                    {analysisResult?.has_user_caution && (
                      <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[12px] text-red-700">
                        <AlertTriangle className="w-4 h-4" />
                        <span>
                          {analysisResult.warning_message ||
                            '선택하신 주의 성분이 포함되어 있습니다.'}
                        </span>
                      </div>
                    )}
                    <p className="text-base font-medium leading-relaxed">
                      {cleanOpinion.replace(/\*\*/g, '')}
                    </p>
                  </div>
                </div>
              </div>

              {/* 닫기 버튼 */}
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
        </div>
      )}

      {/* --- 3. 사용자 주의 성분 경고 모달 --- */}
      {analysisResult?.has_user_caution && showCautionModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          role="alertdialog"
          aria-modal="true"
        >
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

              <div className="mb-3">
                <p className="text-sm text-gray-700">
                  적용 정책: 사용자 주의 성분 발견 시{' '}
                  <span className="font-semibold text-red-600">즉시 -40점</span> 감점
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  {typeof analysisResult.score_before === 'number' && (
                    <span className="text-lg font-semibold text-gray-400 line-through">
                      {analysisResult.score_before}
                    </span>
                  )}
                  <span className="text-2xl font-bold text-red-600">
                    {analysisResult.final_score}
                  </span>
                  <span className="text-sm text-gray-600">/ 100점</span>
                </div>
              </div>

              {Array.isArray(analysisResult.user_caution) &&
                analysisResult.user_caution.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-gray-800 mb-1">
                      감지된 사용자 주의 성분
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.user_caution.slice(0, 5).map((u, idx) => (
                        <span
                          key={`${u.korean_name}-${idx}`}
                          className="px-2 py-1 rounded-full border border-red-200 bg-red-50 text-red-700 text-xs"
                        >
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
