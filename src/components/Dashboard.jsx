import React, { useState, useRef, useEffect } from "react";
import Slidebar from "./Slidebar";

const Dashboard = () => {
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);

  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        slidebarRef.current &&
        !slidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      ) {
        setShowSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="homepage-container">
      <Slidebar />
      HOLA MUNDO
    </div>
  );
};

export default React.memo(Dashboard);
