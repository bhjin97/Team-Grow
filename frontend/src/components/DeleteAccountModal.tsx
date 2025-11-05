'use client';

import * as React from 'react';
import { API_BASE } from '../lib/env';

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;     // 예: "더미9" (users.name)
  userId: number | null; // 예: 9 (localStorage의 user_id)
}

export default function DeleteAccountModal({
  open,
  onClose,
  userName,
  userId,
}: DeleteAccountModalProps) {
  const [value, setValue] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const expected = `DELETE ${userName}`;

  React.useEffect(() => {
    if (!open) {
      setValue('');
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const disabled =
    value.trim() !== expected || loading || !userId || Number.isNaN(userId);

  const handleDelete = async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE}/api/account/me`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        } as any,
        body: JSON.stringify({
          user_id: userId,
          confirm: value,
        }),
      });

      if (res.status === 204) {
        // 성공: 클라이언트 세션 정리 후 이동
        localStorage.removeItem('token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        localStorage.removeItem('skin_type_code');
        localStorage.removeItem('skin_axes_json');
        window.location.href = '/';
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data?.detail || '삭제에 실패했습니다.');
    } catch (e: any) {
      setError(e?.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-[92vw] max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">계정 삭제</h3>
        <p className="mt-2 text-sm text-gray-600">
          이 작업은 되돌릴 수 없다. 아래에&nbsp;
          <b>{expected}</b>&nbsp;를 정확히 입력해야 한다.
        </p>

        <div className="mt-4">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={expected}
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-rose-300"
          />
          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
          {!userId && <p className="mt-2 text-xs text-amber-600">user_id가 확인되지 않았다. 로그인 상태를 다시 확인해라.</p>}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={disabled}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              disabled ? 'bg-rose-200 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'
            }`}
          >
            {loading ? '삭제 중…' : '영구 삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
