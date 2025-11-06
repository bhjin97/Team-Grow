import { Clock, Heart, TrendingUp } from 'lucide-react';
import { Card } from '@/shared/ui';
import { FavoriteProduct, RecentRecommendation } from '@/entities/product';
import { FavoriteProducts } from './FavoriteProducts';
import { RecentRecommendations } from './RecentRecommendations';

export interface ActivityTabProps {
  favorites: FavoriteProduct[];
  recommendations: RecentRecommendation[];
  onRemoveFavorite: (productId: number) => void;
  onFavoriteClick: (productId: number) => void;
  onRecommendationClick: (product: RecentRecommendation) => void;
}

export const ActivityTab = ({
  favorites,
  recommendations,
  onRemoveFavorite,
  onFavoriteClick,
  onRecommendationClick,
}: ActivityTabProps) => {
  return (
    <div className="flex flex-col space-y-6">
      {/* 최근 찾아본 성분 */}
      <Card variant="gradient" padding="md">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
          <Clock className="w-5 h-5 text-purple-500 mr-2" />
          최근 찾아본 성분
        </h3>
        <div className="space-y-3">
          <p className="text-gray-500 text-sm text-center py-6">
            아직 조회한 성분이 없습니다.
          </p>
        </div>
      </Card>

      {/* 즐겨찾기 제품 */}
      <Card variant="gradient" padding="md">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
          <Heart className="w-5 h-5 text-pink-500 mr-2" />
          즐겨찾기 제품
        </h3>
        <FavoriteProducts
          products={favorites}
          onRemove={onRemoveFavorite}
          onProductClick={onFavoriteClick}
        />
      </Card>

      {/* 최근 추천받은 제품 */}
      <Card variant="gradient" padding="md">
        <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 text-pink-500 mr-2" />
          최근 추천받은 제품
        </h3>
        <RecentRecommendations
          recommendations={recommendations}
          onProductClick={onRecommendationClick}
        />
      </Card>
    </div>
  );
};
