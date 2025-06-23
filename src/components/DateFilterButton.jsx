import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const DateFilterButton = ({ filter, setFilter }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleDateRangeChange = (dates) => {
    const [start, end] = dates;
    setFilter({ fechaInicio: start, fechaFin: end });
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowDatePicker((prev) => !prev)}
        className="filter-button"
      >
        Filtrar Fechas
      </button>
      {showDatePicker && (
        <div style={{ position: "absolute", zIndex: 10 }}>
          <DatePicker
            selected={filter.fechaInicio}
            onChange={handleDateRangeChange}
            startDate={filter.fechaInicio}
            endDate={filter.fechaFin}
            selectsRange
            inline
          />
        </div>
      )}
    </div>
  );
};

export default DateFilterButton;
