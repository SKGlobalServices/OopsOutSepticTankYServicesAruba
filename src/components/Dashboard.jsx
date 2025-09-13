import React, { useState } from "react";
import Slidebar from "./Slidebar";
import { GraficoSlider } from "./Dashboard/GraficoSlider";
import "./Dashboard/Dashboard.css";

const Dashboard = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Sample data for metrics cards
  const metricsData = [
    {
      label: "Ingresos Totales",
      value: "$45,250",
      change: "+12.5%",
      type: "positive"
    },
    {
      label: "Gastos del Mes",
      value: "$8,420",
      change: "-3.2%",
      type: "negative"
    },
    {
      label: "Servicios Completados",
      value: "142",
      change: "+8.1%",
      type: "positive"
    },
    {
      label: "Facturas Pendientes",
      value: "23",
      change: "-15.3%",
      type: "positive"
    }
  ];

  const sliderTitles = [
    {
      title: "Análisis Financiero",
      subtitle: "Ganancias, Pérdidas e Ingresos Totales",
      charts: ["Ganancia/Pérdida", "Ingresos Totales", "Total Gastos"]
    },
    {
      title: "Métodos de Pago",
      subtitle: "Transferencias, Efectivo e Intercambios",
      charts: ["Transferencias", "Efectivo", "Intercambios"]
    },
    {
      title: "Servicios y Facturación",
      subtitle: "Servicios, Facturas y Garantías",
      charts: ["Servicios", "Facturas/Deudas", "Garantías"]
    }
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % sliderTitles.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + sliderTitles.length) % sliderTitles.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="homepage-container">
      <Slidebar />
      
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Dashboard Analítico</h1>
            <p className="dashboard-subtitle">
              Resumen completo de servicios y finanzas
            </p>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="metrics-grid">
          {metricsData.map((metric, index) => (
            <div key={index} className="metric-card">
              <div className="metric-header">
                <div className="metric-label">{metric.label}</div>
              </div>
              <div className="metric-value">{metric.value}</div>
              <div className={`metric-change ${metric.type}`}>
                {metric.change} vs mes anterior
              </div>
            </div>
          ))}
        </div>

        {/* Slider Section */}
        <div className="slider-section">
          <div className="slider-header">
            <div className="slider-info">
              <h2 className="slider-title">{sliderTitles[currentSlide].title}</h2>
              <p className="slider-subtitle">{sliderTitles[currentSlide].subtitle}</p>
            </div>
            <div className="slide-counter">
              {currentSlide + 1} / {sliderTitles.length}
            </div>
          </div>

          <div className="slider-container">
            <button 
              className="nav-button" 
              onClick={prevSlide}
              disabled={currentSlide === 0}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10 2L4 8l6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="slides-wrapper">
              <div className="slides-container">
                <GraficoSlider currentSlide={currentSlide} />
              </div>
            </div>

            <button 
              className="nav-button" 
              onClick={nextSlide}
              disabled={currentSlide === sliderTitles.length - 1}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 2l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Slider Navigation */}
          <div className="slider-navigation">
            <div className="slide-dots">
              {sliderTitles.map((_, index) => (
                <button
                  key={index}
                  className={`slide-dot ${currentSlide === index ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                >
                  <div className="dot-inner"></div>
                </button>
              ))}
            </div>
            
            <div className="slide-labels">
              {sliderTitles.map((slider, index) => (
                <span
                  key={index}
                  className={currentSlide === index ? 'label-active' : ''}
                  onClick={() => goToSlide(index)}
                >
                  {slider.title}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(Dashboard);
