import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Card } from '@/shared/ui';
import { FavoriteProduct } from '@/entities/product';

export interface FavoriteProductsProps {
  products: FavoriteProduct[];
  onRemove: (productId: number) => void;
  onProductClick: (productId: number) => void;
}

export const FavoriteProducts = ({ products, onRemove, onProductClick }: FavoriteProductsProps) => {
  if (products.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-6">아직 즐겨찾기한 제품이 없습니다.</p>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3 sm:gap-4 min-w-max">
        {products.map((product, index) => (
          <motion.div
            key={product.product_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * index }}
            className="flex-shrink-0 w-40 sm:w-48 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 hover:shadow-md relative cursor-pointer"
            onClick={() => onProductClick(product.product_id)}
          >
            <button
              onClick={e => {
                e.stopPropagation();
                onRemove(product.product_id);
              }}
              className="absolute top-2 right-2 p-1.5 bg-white rounded-full text-gray-500 hover:text-red-500 shadow-sm z-10"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-full aspect-square bg-white rounded-lg mb-2 flex items-center justify-center">
              <img
                src={product.image_url}
                alt={product.product_name}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
              {product.product_name}
            </p>
            <p className="text-[11px] text-gray-500">{product.category}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
