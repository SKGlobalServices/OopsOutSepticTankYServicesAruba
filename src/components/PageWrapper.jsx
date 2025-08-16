import React, { useEffect } from 'react';
import LoadingScreen from './LoadingScreen';
import { useGlobalLoading, setGlobalLoading } from '../utils/useGlobalLoading';
import { useNavigate } from 'react-router-dom';

const PageWrapper = ({ children }) => {
  const globalLoading = useGlobalLoading();
  const navigate = useNavigate();

  useEffect(() => {
    const checkPlatformClosure = () => {
      const now = new Date();
      if (now.getHours() === 23) {
        localStorage.clear();
        sessionStorage.clear();
        alert('La plataforma está cerrada de 11:00 PM a 12:00 AM. Será redirigido al login.');
        navigate('/');
      }
    };

    // Verificar inmediatamente
    checkPlatformClosure();
    
    // Verificar cada minuto
    const interval = setInterval(checkPlatformClosure, 60000);
    
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <>
      {globalLoading && <LoadingScreen />}
      {children}
    </>
  );
};

export default PageWrapper;