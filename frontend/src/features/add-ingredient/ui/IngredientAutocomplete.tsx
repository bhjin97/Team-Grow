import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Ingredient } from '@/entities/ingredient';
import { cn } from '@/shared/lib/utils';

export interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: Ingredient[];
  onSelect: (ingredient: Ingredient) => void;
  placeholder?: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export const IngredientAutocomplete = ({
  value,
  onChange,
  suggestions,
  onSelect,
  placeholder = '한글/영문으로 검색',
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: IngredientAutocompleteProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const showSuggestions = isFocused && value.trim().length > 0 && suggestions.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 무한 스크롤 감지
  useEffect(() => {
    if (!showSuggestions || !hasMore || !onLoadMore || !listRef.current) return;

    const handleScroll = () => {
      if (!listRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      
      // 바닥에서 50px 이내로 스크롤하면 더 로드
      if (scrollHeight - scrollTop - clientHeight < 50 && !isLoading) {
        onLoadMore();
      }
    };

    const list = listRef.current;
    list.addEventListener('scroll', handleScroll);
    return () => list.removeEventListener('scroll', handleScroll);
  }, [showSuggestions, hasMore, onLoadMore, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          onSelect(suggestions[selectedIndex]);
          setIsFocused(false);
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        setIsFocused(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-4 py-2 border rounded-lg text-sm',
            'focus:outline-none focus:ring-2 focus:ring-pink-300',
            'bg-white',
            isFocused && showSuggestions ? 'rounded-b-none' : ''
          )}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-pink-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* 자동완성 드롭다운 */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full bg-white border border-t-0 border-gray-200 rounded-b-lg shadow-lg max-h-[300px] overflow-y-auto z-50"
          >
            <div ref={listRef} className="overflow-y-auto max-h-[300px]">
              {suggestions.map((ingredient, index) => (
                <button
                  key={ingredient.id}
                  onClick={() => {
                    onSelect(ingredient);
                    setIsFocused(false);
                    setSelectedIndex(-1);
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-pink-50 transition-colors border-b border-gray-100 last:border-b-0',
                    selectedIndex === index && 'bg-pink-50'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {ingredient.korean_name}
                      </p>
                      {ingredient.english_name && (
                        <p className="text-xs text-gray-500 truncate">{ingredient.english_name}</p>
                      )}
                    </div>
                    {ingredient.caution_grade && (
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0',
                          ingredient.caution_grade.includes('고')
                            ? 'bg-red-100 text-red-700'
                            : ingredient.caution_grade.includes('중')
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {ingredient.caution_grade}
                      </span>
                    )}
                  </div>
                  {ingredient.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                      {ingredient.description}
                    </p>
                  )}
                </button>
              ))}

              {/* 더 불러오기 표시 */}
              {hasMore && (
                <div className="px-4 py-2 text-center text-xs text-gray-500">
                  {isLoading ? '불러오는 중...' : '스크롤하여 더 보기'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
