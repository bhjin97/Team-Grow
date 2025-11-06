import { Modal, Button } from '@/shared/ui';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { Ingredient, IngredientType } from '@/entities/ingredient';

export interface AddIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  ingredient: Ingredient | null;
  onConfirm: (type: IngredientType) => void;
}

export const AddIngredientModal = ({
  isOpen,
  onClose,
  ingredient,
  onConfirm,
}: AddIngredientModalProps) => {
  if (!ingredient) return null;

  const handleSelect = (type: IngredientType) => {
    onConfirm(type);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="성분 추가" size="md">
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-bold text-gray-800 text-lg mb-1">{ingredient.korean_name}</h4>
          {ingredient.english_name && (
            <p className="text-sm text-gray-600">{ingredient.english_name}</p>
          )}
          {ingredient.description && (
            <p className="text-sm text-gray-500 mt-2">{ingredient.description}</p>
          )}
          {ingredient.caution_grade && (
            <div className="mt-2">
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                  ingredient.caution_grade.includes('고')
                    ? 'bg-red-100 text-red-700'
                    : ingredient.caution_grade.includes('중')
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                주의 등급: {ingredient.caution_grade}
              </span>
            </div>
          )}
        </div>

        <p className="text-center text-gray-700 font-medium">
          이 성분을 어디에 추가하시겠어요?
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => handleSelect('preferred')}
            className="group p-6 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-green-700" />
              </div>
              <h5 className="font-bold text-gray-800">선호 성분</h5>
              <p className="text-xs text-gray-600 text-center">
                피부에 좋은 효과를 주는 성분
              </p>
            </div>
          </button>

          <button
            onClick={() => handleSelect('caution')}
            className="group p-6 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 transition-all"
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-red-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-6 h-6 text-red-700" />
              </div>
              <h5 className="font-bold text-gray-800">주의 성분</h5>
              <p className="text-xs text-gray-600 text-center">
                피부에 자극이나 문제를 일으킬 수 있는 성분
              </p>
            </div>
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
        </div>
      </div>
    </Modal>
  );
};
