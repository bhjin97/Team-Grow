import { motion } from 'framer-motion';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Card } from '@/shared/ui';
import { CautionIngredient } from '@/entities/ingredient';

export interface CautionIngredientsListProps {
  ingredients: CautionIngredient[];
  onRemove: (index: number) => void;
}

const getSeverityColor = (severity: string) =>
  severity === 'high'
    ? 'bg-red-50 border-red-300'
    : severity === 'mid'
      ? 'bg-amber-50 border-amber-300'
      : 'bg-yellow-50 border-yellow-300';

const getSeverityBadge = (severity: string) =>
  severity === 'high'
    ? 'bg-red-100 text-red-700'
    : severity === 'mid'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-yellow-100 text-yellow-700';

export const CautionIngredientsList = ({
  ingredients,
  onRemove,
}: CautionIngredientsListProps) => {
  return (
    <Card variant="gradient" padding="md" className="bg-red-50 border-red-200">
      <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
        <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
        주의 성분 ({ingredients.length})
      </h3>
      <div className="space-y-3">
        {ingredients.map((ingredient, index) => (
          <motion.div
            key={ingredient.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className={`rounded-lg p-3 sm:p-4 border-2 hover:shadow-md transition-shadow ${getSeverityColor(ingredient.severity)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="text-sm sm:text-base font-bold text-gray-800">
                    {ingredient.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${getSeverityBadge(ingredient.severity)}`}
                  >
                    {ingredient.severity}
                  </span>
                </div>
                <p className="text-xs sm:text-sm">{ingredient.reason}</p>
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
          <div className="text-sm text-gray-500 text-center py-4">
            추가된 주의 성분이 없습니다.
          </div>
        )}
      </div>
    </Card>
  );
};
