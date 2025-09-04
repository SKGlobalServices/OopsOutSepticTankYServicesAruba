import React, { useState, useEffect } from 'react';
import logo from '../assets/img/logosolo.png';

const LoadingScreen = () => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
    }, 3700);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="loading-content">
        <img src={logo} alt="Logo" className="loading-logo" />
        <div className="loading-spinner"></div>
        <p className="loading-text">Cargando...</p>
      </div>
    </div>
  );
};

export default React.memo(LoadingScreen);