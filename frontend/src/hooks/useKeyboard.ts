import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface KeyHandlers {
  [key: string]: KeyHandler;
}

export function useKeyboard(keyHandlers: KeyHandlers, deps: any[] = []) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const handler = keyHandlers[e.key];
      if (handler) {
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyHandlers, ...deps]);
}

