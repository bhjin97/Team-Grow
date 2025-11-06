import { PreferredIngredient, CautionIngredient, Ingredient } from '@/entities/ingredient';
import { PreferredIngredientsList } from './PreferredIngredientsList';
import { CautionIngredientsList } from './CautionIngredientsList';

export interface IngredientsTabProps {
  preferredIngredients: PreferredIngredient[];
  cautionIngredients: CautionIngredient[];
  onRemovePreferred: (index: number) => void;
  onRemoveCaution: (index: number) => void;
  searchSection: React.ReactNode; // Feature로 분리될 검색/추가 섹션
}

export const IngredientsTab = ({
  preferredIngredients,
  cautionIngredients,
  onRemovePreferred,
  onRemoveCaution,
  searchSection,
}: IngredientsTabProps) => {
  return (
    <div className="space-y-6">
      {/* 성분 검색/추가 섹션 (Feature) */}
      {searchSection}

      {/* 선호/주의 성분 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <PreferredIngredientsList ingredients={preferredIngredients} onRemove={onRemovePreferred} />

        <CautionIngredientsList ingredients={cautionIngredients} onRemove={onRemoveCaution} />
      </div>
    </div>
  );
};
