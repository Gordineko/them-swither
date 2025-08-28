import { useState, useEffect } from "react";

// Определяем устройство один раз, безопасно при SSR
const getDeviceType = () => {
  if (typeof window === "undefined") return "desktop"; // SSR fallback

  const width = window.innerWidth;

  if (width < 500) return "mobile";
  if (width < 680) return "little-tablet";
  if (width < 1200) return "tablet";
  return "desktop";
};

const useMedia = () => {
  const [device, setDevice] = useState(getDeviceType);

  useEffect(() => {
    const handleResize = () => {
      const newDevice = getDeviceType();
      setDevice((prev) => (prev !== newDevice ? newDevice : prev)); // обновляем только если изменилось
    };

    handleResize(); // первый запуск (на случай resize до mount)

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return device;
};

export default useMedia;
