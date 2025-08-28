import { createContext, useState, useContext, useEffect } from "react";

const ModalsContext = createContext();

export const ModalsProvider = ({ children }) => {
  const [isModalOpen, setIsModalOpen] = useState(null);
  const [isProd, setIsProd] = useState(null);

  useEffect(() => {
    const body = document.body;
    const stickyHeader = document.querySelector(".header-bottom.sticky");

    const skip = [
      "header-catalog",
      "more",
      "phone",
      "order-inf",
      "compare-conf",
      "save-comp",
    ];

    const shouldLock = isModalOpen !== null && !skip.includes(isModalOpen);

    if (shouldLock) {
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      body.style.overflow = "hidden";
      body.style.paddingRight = `${scrollBarWidth}px`;

      if (stickyHeader) {
        stickyHeader.style.paddingRight = `${scrollBarWidth}px`;
      }
    } else {
      body.style.overflow = "";
      body.style.paddingRight = "";

      if (stickyHeader) {
        stickyHeader.style.paddingRight = "";
      }
    }

    return () => {
      body.style.overflow = "";
      body.style.paddingRight = "";

      if (stickyHeader) {
        stickyHeader.style.paddingRight = "";
      }
    };
  }, [isModalOpen]);

  return (
    <ModalsContext.Provider
      value={{ isModalOpen, setIsModalOpen, isProd, setIsProd }}
    >
      {children}
    </ModalsContext.Provider>
  );
};

export const useModals = () => useContext(ModalsContext);
