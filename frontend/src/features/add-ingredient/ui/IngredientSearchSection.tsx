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
  const { 
    ingredients, 
    isLoading, 
    searchQuery, 
    setSearchQuery,
    hasMore,
    loadMore,
  } = useIngredients();
  
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
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
              onChange={setSearchQuery}
              suggestions={ingredients}
              onSelect={handleSelectIngredient}
              isLoading={isLoading}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </div>

          <div className="text-xs text-gray-500">
            💡 성분명을 입력하면 자동완성 목록이 나타납니다. 원하는 성분을 클릭하여
            선호/주의 성분으로 추가하세요.
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
