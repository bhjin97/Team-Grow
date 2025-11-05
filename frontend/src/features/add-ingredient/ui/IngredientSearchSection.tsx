// IngredientSearchSection.tsx
import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Card } from '@/shared/ui';
import { Ingredient, IngredientType } from '@/entities/ingredient';
import { useIngredients } from '@/shared/lib/hooks';
import { IngredientAutocomplete } from './IngredientAutocomplete';
import { AddIngredientModal } from './AddIngredientModal';

export interface IngredientSearchSectionProps {
  onAddIngredient: (ingredient: Ingredient, type: IngredientType) => void;
}

export const IngredientSearchSection = ({ onAddIngredient }: IngredientSearchSectionProps) => {
  const { ingredients, isLoading, searchQuery, setSearchQuery, search } = useIngredients();

  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [newIngredientType, setNewIngredientType] = useState<'preferred' | 'caution'>('preferred');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelectIngredient = (ingredient: Ingredient) => {
    setSelectedIngredient(ingredient);
    setIsModalOpen(true);
    setSearchQuery(''); // 선택 후 검색어 초기화
  };

  const handleConfirmAdd = (type: IngredientType) => {
    if (selectedIngredient) {
      onAddIngredient(selectedIngredient, type);
      setSelectedIngredient(null);
    }
  };

  return (
    <>
      <Card variant="gradient" padding="md" className="border-pink-200">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 flex items-center">
          <SearchIcon className="w-5 h-5 text-pink-500 mr-2" />
          성분 검색 및 추가
        </h3>

        <div className="space-y-4">
          {/* 자동완성 검색 */}
          <div className="flex flex-col sm:flex-row gap-3">
            <IngredientAutocomplete
              value={searchQuery}
              // 입력 시 훅의 상태와 서버 검색 모두 트리거
              onChange={v => {
                setSearchQuery(v);
                search(v);
              }}
              suggestions={ingredients}
              onSelect={handleSelectIngredient}
              isLoading={isLoading}
            />
            <select
              value={newIngredientType}
              onChange={e => setNewIngredientType(e.target.value as 'preferred' | 'caution')}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              <option value="preferred">선호 성분</option>
              <option value="caution">주의 성분</option>
            </select>
            <button
              className="px-6 py-2 rounded-lg text-white font-medium hover:shadow-lg transition-all text-sm"
              style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
              disabled={!selectedIngredient}
            >
              추가
            </button>
          </div>

          {/* 목록 */}
          <div className="mt-4 border rounded-lg bg-white">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-600 border-b">
              <div className="col-span-3">한글명</div>
              <div className="col-span-3">영문명</div>
              <div className="col-span-4">설명</div>
              <div className="col-span-1 text-center">주의</div>
            </div>
            <div className="max-h-[360px] overflow-auto divide-y">
              {/* ✅ filteredIngredients → ingredients로 교체 */}
              {ingredients.map(it => (
                <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                  <div className="col-span-3 font-semibold text-gray-800 line-clamp-1">
                    {it.korean_name}
                  </div>
                  <div className="col-span-3 text-gray-600 text-xs line-clamp-1">
                    {it.english_name || '-'}
                  </div>
                  <div className="col-span-4 text-gray-600 text-xs line-clamp-2">
                    {it.description || '-'}
                  </div>
                  <div className="col-span-1 flex flex-col items-center gap-2">
                    <span
                      className={
                        (it.caution_grade || '').includes('고')
                          ? 'px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700'
                          : (it.caution_grade || '').includes('중')
                            ? 'px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700'
                            : 'px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600'
                      }
                    >
                      {it.caution_grade || '-'}
                    </span>
                    <div className="flex gap-1">
                      <button className="px-2 py-0.5 rounded text-[11px] bg-green-100 text-green-700">
                        선호
                      </button>
                      <button className="px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-700">
                        주의
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {ingredients.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  검색 결과가 없습니다.
                </div>
              ) : (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  {ingredients.length} 성분 검색 결과
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-gray-500">
            💡 성분명을 입력하면 자동완성 목록이 나타납니다. 원하는 성분을 클릭하여 선호/주의
            성분으로 추가하세요.
          </div>
        </div>
      </Card>

      {/* 성분 타입 선택 모달 */}
      <AddIngredientModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedIngredient(null);
        }}
        ingredient={selectedIngredient}
        onConfirm={handleConfirmAdd}
      />
    </>
  );
};
