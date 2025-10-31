'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Search, Loader2, AlertTriangle, X } from 'lucide-react';
import * as React from 'react';
import { fetchSimulation, fetchCategories, fetchProductsByCategory } from '../../lib/utils';
import Plot from 'react-plotly.js';

const KEYWORD_ENG_TO_KOR: Record<string, string> = {
  'moisturizing': '보습', 'soothing': '진정', 'sebum_control': '피지',
  'anti_aging': '주름', 'brightening': '미백', 'protection': '보호'
};

// [★] AnalysisResult 타입 수정
interface AnalysisResult {
  final_score: number;
  product_info: { 
    name: string; 
    category: string;
    total_count: number;
    matched_count: number; // '고유 매칭 성분 수'
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
    unmatched: any[]; // [★] 'unmatched_count' -> 'unmatched' 리스트
  };
}

interface VirtualSkinModelProps {
  skinType: string;
}

export default function VirtualSkinModel({
  skinType
}: VirtualSkinModelProps) {

  // --- 상태 관리 (기존과 동일) ---
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSimLoading, setIsSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showFullReport, setShowFullReport] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isListLoading, setIsListLoading] = useState(false);

  // --- 데이터 로드 로직 (기존과 동일) ---
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await fetchCategories();
        setCategories(cats);
      } catch (err) { console.error("카테고리 로드 실패:", err); }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      const loadProducts = async () => {
        setIsListLoading(true);
        setProducts([]);
        setSelectedProduct("");
        setAnalysisResult(null);
        try {
          const productList = await fetchProductsByCategory(selectedCategory);
          setProducts(productList.map(p => p.product_name)); 
        } catch (err) { console.error("제품 목록 로드 실패:", err); } 
        finally { setIsListLoading(false); }
      };
      loadProducts();
    } else {
      setProducts([]);
      setSelectedProduct("");
    }
  }, [selectedCategory]);

  // --- API 호출 핸들러 (기존과 동일) ---
  const handleSimulation = async () => {
    if (!selectedProduct) {
      setSimError('제품을 선택하거나 입력해주세요.');
      return;
    }
    setIsSimLoading(true);
    setSimError(null);
    setAnalysisResult(null); 
    try {
      const result = await fetchSimulation(selectedProduct, skinType);
      setAnalysisResult(result);
    } catch (err) {
      if (err instanceof Error) { setSimError(err.message); } 
      else { setSimError('알 수 없는 오류가 발생했습니다.'); }
    } finally {
      setIsSimLoading(false);
    }
  };
  
  // --- 차트 데이터/레이아웃 생성 (기존과 동일) ---
  const getChartData = () => {
    if (!analysisResult) return null;
    const commonLayout = {
      font: { family: 'Pretendard, sans-serif', size: 12, color: '#333' },
      plot_bgcolor: 'rgba(0,0,0,0)', paper_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 50, b: 50, l: 50, r: 50 }, hovermode: 'closest',
      title: { font: { size: 18, color: '#333' }, x: 0.5, xanchor: 'center' }
    };
    const gaugeData = [
      {
        type: 'indicator', mode: 'gauge+number', value: analysisResult.final_score,
        title: { text: "적합도 점수", font: { size: 16, color: '#4a4a4a' } },
        gauge: {
          axis: { range: [0, 100], tickwidth: 0, },
          bar: { color: "#e8b4d4", line: { width: 1, color: '#f5c6d9'} },
          bgcolor: "white", borderwidth: 0, steps: [],
          threshold: { line: { color: "red", width: 4 }, thickness: 0.75, value: analysisResult.final_score }
        },
        number: { font: { size: 64, color: '#5b21b6' }, suffix: '' }
      }
    ];
    const breakdownData = Object.entries(analysisResult.charts.breakdown)
      .map(([engKey, data]) => ({ key: KEYWORD_ENG_TO_KOR[engKey] || engKey, contribution: data.contribution }))
      .sort((a, b) => a.contribution - b.contribution);
    const barData = [
      {
        type: 'bar', x: breakdownData.map(d => d.contribution), y: breakdownData.map(d => d.key),
        orientation: 'h', marker: { color: '#e8b4d4' },
        text: breakdownData.map(d => d.contribution.toFixed(2)), textposition: 'outside',
        textfont: { color: '#4a4a4a' }
      }
    ];
    const barLayout = {
      ...commonLayout, title: { text: '키워드별 점수 기여도', font: { size: 18, color: '#333' } },
      height: 300, margin: { t: 50, b: 40, l: 80, r: 20 },
      xaxis: { title: { text: '기여도', font: { size: 14, color: '#4a4a4a' } }, showgrid: true, gridcolor: '#f0f0f0' },
      yaxis: { automargin: true, tickfont: { size: 12, color: '#4a4a4a' } }, bargap: 0.3,
    };
    const pieDataRaw = Object.entries(analysisResult.charts.ratios).filter(([key, value]) => value > 0);
    const pieData = [
      {
        type: 'pie', labels: pieDataRaw.map(([key]) => KEYWORD_ENG_TO_KOR[key] || key),
        values: pieDataRaw.map(([key, value]) => value),
        hole: 0.4, textposition: 'inside', textinfo: 'percent+label',
        marker: { colors: ['#f5c6d9', '#e8b4d4', '#d0a2cc', '#b890c5', '#a07ebf', '#886dbe'] },
        hoverinfo: 'label+percent+value', insidetextfont: { color: '#fff', size: 11 },
      }
    ];
    const pieLayout = {
      ...commonLayout, title: { text: '키워드별 성분 비율', font: { size: 18, color: '#333' } },
      height: 400, margin: { t: 50, b: 50, l: 50, r: 50 } 
    };
    return { 
      gaugeData, gaugeLayout: { ...commonLayout, height: 300, margin: { t: 50, b: 0, l: 30, r: 30 }, title: { text: '종합 점수', font: { size: 18, color: '#333' } }},
      barData, barLayout, pieData, pieLayout 
    };
  };

  const chartData = getChartData();

  // --- 메인 UI 렌더링 (기존 카드 + 모달) ---
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
        
        {/* '얼굴 모델' 영역 (기존과 동일) */}
        <div className="h-48 sm:h-56 bg-purple-50 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden p-4">
          {/* ... (로딩/에러/결과 UI 동일) ... */}
          {isSimLoading && (<div className="flex flex-col items-center text-purple-600"><Loader2 className="w-12 h-12 animate-spin" /><span className="mt-3 text-sm font-medium">분석 중입니다...</span></div>)}
          {!isSimLoading && simError && (<div className="flex flex-col items-center text-red-600 text-center"><AlertTriangle className="w-12 h-12 mb-2" /><span className="text-sm font-semibold">오류 발생</span><span className="text-xs mt-1">{simError}</span></div>)}
          {!isSimLoading && analysisResult && (<div className="flex flex-col items-center text-center"><span className="text-sm text-gray-600">{analysisResult.product_info.name}</span><span className="text-xs text-gray-500 mb-2">({skinType} 타입 기준)</span><span className="text-7xl font-bold text-purple-600">{analysisResult.final_score}</span><span className="text-lg font-medium text-gray-700">/ 100점</span></div>)}
          {!isSimLoading && !simError && !analysisResult && (<div className="text-center text-gray-500"><span className="text-sm sm:text-base font-medium">카테고리를 선택하고 제품을 분석하세요.</span><Search className="w-10 h-10 mx-auto mt-2 opacity-30" /></div>)}
        </div>

        {/* 버튼 영역 (기존과 동일) */}
        <div className="space-y-2">
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base">
            <option value="">📂 카테고리 선택...</option>
            {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
          {selectedCategory && (
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} disabled={isListLoading} className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base">
              <option value="">{isListLoading ? '제품 로딩 중...' : '🧴 제품 선택...'}</option>
              {products.map((prodName) => (<option key={prodName} value={prodName}>{prodName}</option>))}
            </select>
          )}
          <div className="relative">
            <input type="text" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} placeholder="또는 제품명 직접 검색/입력" className="w-full py-2.5 sm:py-3 pl-4 pr-10 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-300 focus:ring-2 focus:outline-none text-sm sm:text-base"/>
            <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button onClick={handleSimulation} disabled={isSimLoading || !selectedProduct} className="w-full py-2.5 sm:py-3 rounded-xl font-medium text-white shadow-md hover:shadow-lg transition-all text-sm sm:text-base disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}>
            {isSimLoading ? '분석 중...' : '제품 효과 시뮬레이션'}
          </button>
          {analysisResult && (
            <button onClick={() => setShowFullReport(true)} className="w-full py-2 rounded-lg border-2 border-purple-200 text-purple-600 text-sm sm:text-base font-medium hover:bg-purple-50 transition-colors">
              결과 전체보기 (장/단점, 성분표)
            </button>
          )}
        </div>
      </motion.div>

      {/* --- 2. 전체보기 모달 (UI 재배치 및 확장) --- */}
      {showFullReport && analysisResult && chartData && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFullReport(false)}
        >
          {/* [★] 모달 크기 max-w-6xl (가로 확장) */}
          <div 
            className="bg-white rounded-2xl p-6 w-full max-w-6xl max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">상세 분석 결과</h2>
              <button onClick={() => setShowFullReport(false)} className="text-gray-500 hover:text-gray-800">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* [★] Streamlit과 동일한 레이아웃으로 재배치 */}
            <div className="space-y-8">

              {/* [★] 1. 제품 정보 (st.metric) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">제품명</p>
                  <p className="text-lg font-semibold text-gray-900 truncate" title={analysisResult.product_info.name}>
                    {analysisResult.product_info.name}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">카테고리</p>
                  <p className="text-lg font-semibold text-gray-900">{analysisResult.product_info.category}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">총 성분</p>
                  <p className="text-lg font-semibold text-gray-900">{analysisResult.product_info.total_count}개</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center shadow-sm">
                  <p className="text-sm text-gray-500">고유 매칭 성분</p>
                  <p className="text-lg font-semibold text-gray-900">{analysisResult.product_info.matched_count}개</p>
                </div>
              </div>

              {/* [★] 2. 시각화 (3-Grid) */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">시각화</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="border rounded-lg p-2 md:col-span-2">
                    <Plot
                      data={chartData.gaugeData}
                      layout={chartData.gaugeLayout}
                      useResizeHandler={true} className="w-full h-full"
                    />
                  </div>
                  <div className="border rounded-lg p-2 md:col-span-3">
                    <Plot
                      data={chartData.barData}
                      layout={chartData.barLayout}
                      useResizeHandler={true} className="w-full h-full"
                    />
                  </div>
                </div>
                <div className="border rounded-lg p-2">
                  <Plot
                    data={chartData.pieData}
                    layout={chartData.pieLayout}
                    useResizeHandler={true} className="w-full"
                  />
                </div>
              </div>

              {/* [★] 3. 성분 상세 표 (미분류 성분 테이블 추가) */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800">성분 상세</h3>
                <div>
                  <h4 className="text-lg font-semibold">📋 매칭된 성분 ({analysisResult.ingredients.matched.length}개 키워드 히트)</h4>
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
                {/* [★] 미분류 성분 테이블 */}
                <details>
                  <summary className="text-md font-semibold cursor-pointer text-gray-700 hover:text-black">
                    ⚠️ 점수에서 제외된 성분 ({analysisResult.ingredients.unmatched.length}개) (클릭하여 열기)
                  </summary>
                  <div className="p-4 bg-gray-50 rounded-lg mt-2 text-sm">
                    <p className="mb-2">이 성분들은 DB에 등록되지 않았거나, 6대 핵심 효능과 직접적인 관련이 적어 점수 계산에서는 제외되었습니다. (예: 방부제, 점증제, 유화제 등)</p>
                    
                    {/* [★] 미분류 성분 테이블 추가 */}
                    <div className="max-h-48 overflow-y-auto border rounded-lg bg-white">
                      <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                          <tr>
                            <th scope="col" className="px-6 py-3">성분명</th>
                            <th scope="col" className="px-6 py-3">배합목적 (추정)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisResult.ingredients.unmatched.map((item, i) => (
                            <tr className="bg-white border-b" key={i}>
                              <td className="px-6 py-4 font-medium text-gray-900">{item.성분명}</td>
                              <td className="px-6 py-4">{item.배합목적}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              </div>
              
              {/* [★] 4. 분석 근거 (설명) */}
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

              {/* [★] 5. 최종 분석 결과 (맨 마지막으로 이동) */}
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
                  <h4 className="text-lg font-semibold">💡 종합 의견</h4>
                  <p className="text-sm p-3 bg-blue-50 rounded-lg border border-blue-200">{analysisResult.analysis.opinion.replace(/\*\*/g, '')}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}