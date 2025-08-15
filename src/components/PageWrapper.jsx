import React, { useEffect } from 'react';
import { setGlobalLoading } from '../utils/useGlobalLoading';

const PageWrapper = ({ children, loadingTime = 1500 }) => {
  useEffect(() => {
    setGlobalLoading(true);
    const timer = setTimeout(() => {
      setGlobalLoading(false);
    }, loadingTime);
    
    return () => clearTimeout(timer);
  }, [loadingTime]);

  return <>{children}</>;
};

export default PageWrapper;