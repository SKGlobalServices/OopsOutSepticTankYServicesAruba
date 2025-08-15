import React, { useEffect } from 'react';
import LoadingScreen from './LoadingScreen';
import { useGlobalLoading, setGlobalLoading } from '../utils/useGlobalLoading';

const PageWrapper = ({ children }) => {
  const globalLoading = useGlobalLoading();

  useEffect(() => {
    // Solo mostrar pantalla de carga si es recarga de página (no navegación)
    const isPageReload = !sessionStorage.getItem('navigated');
    
    if (isPageReload) {
      setGlobalLoading(true);
      
      const minLoadTime = 4000;
      const startTime = Date.now();
      
      const hideLoading = () => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minLoadTime - elapsed);
        
        setTimeout(() => {
          setGlobalLoading(false);
        }, remaining);
      };
      
      if (document.readyState === 'complete') {
        hideLoading();
      } else {
        window.addEventListener('load', hideLoading);
      }
      
      return () => window.removeEventListener('load', hideLoading);
    }
  }, []);

  return (
    <>
      {globalLoading && <LoadingScreen />}
      {children}
    </>
  );
};

export default PageWrapper;