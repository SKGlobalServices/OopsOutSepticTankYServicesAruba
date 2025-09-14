import React from "react";
import { Slider1 } from "./sliders/Slider1";
import { Slider2 } from "./sliders/Slider2";
import { Slider3 } from "./sliders/Slider3";

export const GraficoSlider = ({ currentSlide }) => {
  const renderCurrentSlide = () => {
    switch (currentSlide) {
      case 0:
        return <Slider1 />;
      case 1:
        return <Slider2 />;
      case 2:
        return <Slider3 />;
      default:
        return <Slider1 />;
    }
  };

  return (
    <div className="slide">
      {renderCurrentSlide()}
    </div>
  );
};