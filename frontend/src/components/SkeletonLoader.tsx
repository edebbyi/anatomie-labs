import React from 'react';

interface SkeletonLoaderProps {
  count?: number;
  columns?: number;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count = 8, columns = 4 }) => {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${columns} gap-4 sm:gap-5`}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="aspect-[3/4] rounded-2xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse"
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;

