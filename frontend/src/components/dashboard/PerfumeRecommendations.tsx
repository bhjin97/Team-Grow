'use client';

// [★] useState, useEffect 및 아이콘, API 함수 임포트
import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
// [★] X (닫기) 아이콘 추가
import { Sparkles, Loader2, AlertTriangle, Wind, X } from 'lucide-react'; 
import { fetchPerfumeRecommendations } from '../../lib/utils';

// [★] perfume.py의 상수들을 React에서 사용하도록 정의
const CITIES = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "경기", "창원", "제주"
];
const LOCATIONS = ['데이트', '출근', '휴식'];
const AGES = ['10대', '20대초반', '20대후반', '30대', '40대이상'];
const MOODS = ['기분전환', '차분한', '설렘', '섹시한', '데일리'];
const PRICE_RANGES = ['가격 무관', '5만원 이하', '5~10만원', '10~15만원', '15만원 이상'];

// [★] API 응답 타입을 위한 인터페이스 정의
interface PerfumeRecommendation {
  name: string;
  brand: string;
  image_url: string;
  final_score: number;
  tags: string[];
  notes: string;
  price: string;
  volume: string;
  description: string;
}
interface WeatherInfo {
  temp: number;
  condition: string;
}

export default function PerfumeRecommendations() {

  // --- [★] 1. 입력 상태 관리 ---
  const [city, setCity] = useState('서울');
  const [location, setLocation] = useState('데이트');
  const [age, setAge] = useState('20대후반');
  const [mood, setMood] = useState('설렘');
  const [priceRange, setPriceRange] = useState('가격 무관');

  // --- [★] 2. 출력 상태 관리 ---
  const [recommendations, setRecommendations] = useState<PerfumeRecommendation[]>([]);
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- [★] 3. 모달 상태 관리 ---
  const [selectedPerfume, setSelectedPerfume] = useState<PerfumeRecommendation | null>(null);

  // --- [★] 4. API 호출 핸들러 ---
  const handleRecommend = async () => {
    setIsLoading(true);
    setError(null);
    setRecommendations([]);
    setWeatherInfo(null);
    
    try {
      const requestData = {
        city: city,
        location: location,
        age: age,
        mood: mood,
        price_range: priceRange
      };
      const result = await fetchPerfumeRecommendations(requestData);
      
      setRecommendations(result.recommendations || []);
      setWeatherInfo(result.weather_info || null);
      
      if (!result.recommendations || result.recommendations.length === 0) {
        setError("현재 조건에 맞는 향수를 찾지 못했습니다.");
      }
      
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- [★] 5. 페이지 로드 시 자동 추천 로직 제거 ---
  // useEffect(() => {
  //   handleRecommend(); 
  // }, []); // ⬅︎ 이 부분을 삭제했습니다.

  return (
    // [★] React.Fragment로 모달과 기존 UI를 감쌉니다.
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
      >
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mr-2" />
          맞춤 향수 추천
        </h3>

        {/* --- [★] 입력 UI (Select 박스) --- */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">📍 위치 (날씨)</label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">🏠 상황 (TPO)</label>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">🎂 연령대</label>
            <select
              value={age}
              onChange={e => setAge(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              {AGES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-600 mb-1 block">💖 분위기</label>
            <select
              value={mood}
              onChange={e => setMood(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">💰 가격대</label>
            <select
              value={priceRange}
              onChange={e => setPriceRange(e.target.value)}
              className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              {PRICE_RANGES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* --- [★] 추천 버튼 --- */}
        <button
          onClick={handleRecommend}
          disabled={isLoading}
          className="w-full py-2.5 sm:py-3 rounded-xl font-medium text-white shadow-md hover:shadow-lg transition-all text-sm sm:text-base disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
          }}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 mx-auto animate-spin" />
          ) : '내 맞춤 향수 찾기'}
        </button>

        {/* --- [★] 결과 표시 --- */}
        <div className="mt-4 space-y-2 sm:space-y-3">
          {/* 날씨 정보 */}
          {weatherInfo && !isLoading && (
            <div className="text-xs text-center text-gray-500 p-2 bg-gray-50 rounded-lg">
              <Wind className="w-4 h-4 inline-block mr-1" />
              현재 {city} 날씨({weatherInfo.condition}, {weatherInfo.temp}°C) 기준 추천입니다.
            </div>
          )}

          {/* 에러 메시지 */}
          {error && !isLoading && (
             <div className="flex flex-col items-center text-red-600 text-center p-4">
               <AlertTriangle className="w-10 h-10 mb-2" />
               <span className="text-sm font-semibold">{error}</span>
             </div>
          )}

          {/* 추천 목록 */}
          {recommendations.map((perfume, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              // [★] 클릭 시 모달 열기
              onClick={() => setSelectedPerfume(perfume)} 
              className="p-3 sm:p-4 rounded-xl bg-pink-50 border border-pink-100 hover:shadow-lg transition-shadow cursor-pointer flex items-center space-x-4"
            >
              <img 
                src={perfume.image_url || 'https://via.placeholder.com/80'} 
                alt={perfume.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-contain bg-white"
              />
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1 sm:mb-2">
                  <div>
                    <h4 className="text-sm sm:text-base font-semibold text-gray-800">
                      {perfume.name}
                    </h4>
                    <p className="text-xs text-gray-500">{perfume.brand}</p>
                  </div>
                  {/* [★] 점수 표시 방식 수정 (4.0점 만점) */}
                  <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-1 rounded-full flex-shrink-0">
                    {perfume.final_score.toFixed(1)} / 4.0점
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">
                  {perfume.notes || perfume.tags.join(', ')}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* --- [★] 3. 상세 정보 모달 추가 --- */}
      {selectedPerfume && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPerfume(null)} // 배경 클릭 시 닫기
        >
          <div 
            className="bg-white rounded-2xl p-6 w-full max-w-lg" // 모달 크기
            onClick={(e) => e.stopPropagation()} // 모달 내부 클릭 방지
          >
            {/* 모달 헤더 */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">{selectedPerfume.name}</h2>
              <button onClick={() => setSelectedPerfume(null)} className="text-gray-500 hover:text-gray-800">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* 모달 바디 */}
            <div className="space-y-4">
              {/* 이미지 */}
              <img 
                src={selectedPerfume.image_url || 'https://via.placeholder.com/150'} 
                alt={selectedPerfume.name}
                className="w-full h-48 sm:h-64 rounded-lg object-contain bg-white border mb-4"
              />
              
              {/* 브랜드, 가격, 용량 */}
              <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                <div>
                  <p className="text-xs text-gray-500">브랜드</p>
                  <p className="font-semibold">{selectedPerfume.brand}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">가격</p>
                  <p className="font-semibold">{selectedPerfume.price}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">용량</p>
                  <p className="font-semibold">{selectedPerfume.volume}</p>
                </div>
              </div>
              
              {/* 태그 */}
              <div className="mb-4">
                <h4 className="text-md font-semibold mb-2">태그</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedPerfume.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* 설명 */}
              <div>
                <h4 className="text-md font-semibold mb-2">설명</h4>
                <p className="text-sm p-3 bg-gray-100 rounded-lg max-h-32 overflow-y-auto">
                  {selectedPerfume.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}