import { cn } from '../../lib/utils';

export interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'waterdrops';
  className?: string;
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export const Loading = ({ size = 'md', variant = 'spinner', className }: LoadingProps) => {
  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center justify-center space-x-1', className)}>
        <span
          className={cn('bg-pink-400 rounded-full animate-bounce', sizeStyles[size])}
          style={{ animationDelay: '0s' }}
        />
        <span
          className={cn('bg-pink-400 rounded-full animate-bounce', sizeStyles[size])}
          style={{ animationDelay: '0.2s' }}
        />
        <span
          className={cn('bg-pink-400 rounded-full animate-bounce', sizeStyles[size])}
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    );
  }

  if (variant === 'waterdrops') {
    return (
      <>
        <style>{`
          @keyframes rise { 
            0% { transform: translateY(0); opacity: 1; } 
            50% { opacity: 0.8; } 
            100% { transform: translateY(-20px); opacity: 0; } 
          }
          .droplet {
            display: inline-block;
            width: 6px;
            height: 6px;
            background: currentColor;
            border-radius: 50%;
            opacity: 0;
            animation: rise 1s ease-in-out infinite;
          }
        `}</style>
        <div className={cn('flex justify-center items-center space-x-1 h-5', className)}>
          <span className="droplet" style={{ animationDelay: '0s' }} />
          <span className="droplet" style={{ animationDelay: '0.2s' }} />
          <span className="droplet" style={{ animationDelay: '0.4s' }} />
        </div>
      </>
    );
  }

  // Default spinner
  return (
    <div
      className={cn(
        'border-2 border-current border-t-transparent rounded-full animate-spin',
        sizeStyles[size],
        className
      )}
    />
  );
};

export const LoadingOverlay = ({ message }: { message?: string }) => {
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4">
        <Loading size="lg" variant="waterdrops" className="text-pink-500" />
        {message && <p className="text-gray-700 font-medium">{message}</p>}
      </div>
    </div>
  );
};
