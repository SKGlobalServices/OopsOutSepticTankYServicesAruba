import React from 'react';
import logo from '../assets/img/logosolo.png';

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img src={logo} alt="Logo" className="loading-logo" />
        <div className="loading-spinner"></div>
        <p className="loading-text">Cargando...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;