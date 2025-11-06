import { Edit2, Save, X } from 'lucide-react';
import { Button } from '@/shared/ui';

export interface EditProfileButtonsProps {
  isEditing: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const EditProfileButtons = ({
  isEditing,
  isSaving,
  onEdit,
  onSave,
  onCancel,
}: EditProfileButtonsProps) => {
  if (!isEditing) {
    return (
      <Button onClick={onEdit} variant="primary" leftIcon={<Edit2 className="w-4 h-4" />}>
        프로필 수정
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <Button
        onClick={onSave}
        variant="secondary"
        isLoading={isSaving}
        leftIcon={!isSaving ? <Save className="w-4 h-4" /> : undefined}
        disabled={isSaving}
      >
        변경사항 저장
      </Button>
      <Button
        onClick={onCancel}
        variant="ghost"
        leftIcon={<X className="w-4 h-4" />}
        disabled={isSaving}
      >
        취소
      </Button>
    </div>
  );
};
