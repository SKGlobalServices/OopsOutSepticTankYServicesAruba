import { useState, useEffect } from 'react';

let globalLoadingState = false;
let globalLoadingListeners = [];

export const setGlobalLoading = (isLoading) => {
  globalLoadingState = isLoading;
  globalLoadingListeners.forEach(listener => listener(isLoading));
};

export const useGlobalLoading = () => {
  const [isLoading, setIsLoading] = useState(globalLoadingState);

  useEffect(() => {
    const listener = (newState) => setIsLoading(newState);
    globalLoadingListeners.push(listener);
    
    return () => {
      globalLoadingListeners = globalLoadingListeners.filter(l => l !== listener);
    };
  }, []);

  return isLoading;
};