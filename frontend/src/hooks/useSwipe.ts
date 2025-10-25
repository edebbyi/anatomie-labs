import { useRef } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  minDistance?: number;
  maxDuration?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  minDistance = 50,
  maxDuration = 300,
}: SwipeHandlers) {
  const touchStart = useRef({ x: 0, y: 0, time: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now(),
    };

    const deltaX = touchEnd.x - touchStart.current.x;
    const deltaY = touchEnd.y - touchStart.current.y;
    const duration = touchEnd.time - touchStart.current.time;

    if (duration > maxDuration) return;

    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

    if (isHorizontal && Math.abs(deltaX) > minDistance) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (!isHorizontal && Math.abs(deltaY) > minDistance) {
      if (deltaY < 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    }
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
  };
}

