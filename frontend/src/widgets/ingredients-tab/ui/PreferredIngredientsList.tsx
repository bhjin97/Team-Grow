import { motion } from 'framer-motion';
import { Sparkles, Trash2 } from 'lucide-react';
import { Card } from '@/shared/ui';
import { PreferredIngredient } from '@/entities/ingredient';

export interface PreferredIngredientsListProps {
  ingredients: PreferredIngredient[];
  onRemove: (index: number) => void;
}

export const PreferredIngredientsList = ({
  ingredients,
  onRemove,
}: PreferredIngredientsListProps) => {
  return (
    <Card variant="gradient" padding="md" className="bg-green-50 border-green-200">
      <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
        <Sparkles className="w-5 h-5 text-green-500 mr-2" />
        선호 성분 ({ingredients.length})
      </h3>
      <div className="space-y-3">
        {ingredients.map((ingredient, index) => (
          <motion.div
            key={ingredient.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="bg-white rounded-lg p-3 sm:p-4 border-2 border-green-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
                  {ingredient.name}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600">{ingredient.benefit}</p>
              </div>
              <button
                onClick={() => onRemove(index)}
                className="ml-3 text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
        {ingredients.length === 0 && (
          <div className="text-sm text-gray-500 text-center py-4">추가된 선호 성분이 없습니다.</div>
        )}
      </div>
    </Card>
  );
};
