import { motion } from 'framer-motion';
import { RecentRecommendation } from '@/entities/product';

export interface RecentRecommendationsProps {
  recommendations: RecentRecommendation[];
  onProductClick: (product: RecentRecommendation) => void;
}

export const RecentRecommendations = ({
  recommendations,
  onProductClick,
}: RecentRecommendationsProps) => {
  if (recommendations.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-6">아직 추천받은 제품이 없습니다.</p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 sm:gap-4 min-w-max">
        {recommendations.map((item, index) => (
          <motion.div
            key={`${item.product_pid}_${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex-shrink-0 w-40 sm:w-48 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 hover:shadow-md relative cursor-pointer"
            onClick={() => onProductClick(item)}
          >
            <div className="w-full aspect-square bg-white rounded-lg mb-2 flex items-center justify-center">
              <img
                src={item.image_url}
                alt={item.display_name}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
              {item.display_name}
            </p>
            <p className="text-[11px] text-gray-500">{item.category}</p>
            <p className="text-[11px] font-semibold text-pink-600 mt-0.5">
              {item.source === 'routine'
                ? '맞춤 루틴 추천'
                : item.source === 'chat'
                  ? 'AI 상담 추천'
                  : '기타 추천'}
            </p>
            {item.reason && (
              <p className="text-[10px] text-gray-400 truncate">{item.reason}</p>
            )}
            {item.review_count !== undefined && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                리뷰 {item.review_count.toLocaleString()}개
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
