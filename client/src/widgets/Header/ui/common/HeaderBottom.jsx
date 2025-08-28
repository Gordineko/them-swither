import { useModals } from "@shared/context/ModalsContext";
import { useTheme } from "@shared/lib/useTheme";
import { useRouter } from "next/router";

const HeaderBottom = ({ categories }) => {
  const router = useRouter();
  const { isModalOpen, setIsModalOpen } = useModals();
  const { theme, toggle } = useTheme();
  return (
    <div
      className={`header__bottom  ${
        router.pathname === "/" ? "" : "header__variation-bg "
      }`}
    >
      <div className="header__bottom-content">
        <div className="logo">
          <p>logo</p>
        </div>
        <ul className="header__list">
          <li className="header__item">
            <label className="theme-switch" aria-label="Toggle theme">
              <input
                type="checkbox"
                className="theme-switch__checkbox"
                checked={theme === "dark"}
                onChange={toggle} // ← переключаем тему здесь
              />
              <div
                className="theme-switch__container"
                role="switch"
                aria-checked={theme === "dark"}
              >
                <div className="theme-switch__clouds"></div>
                <div className="theme-switch__stars-container">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 144 55"
                    fill="none"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M135.831 3.00688C135.055 3.85027..."
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className="theme-switch__circle-container">
                  <div className="theme-switch__sun-moon-container">
                    <div className="theme-switch__moon">
                      <div className="theme-switch__spot"></div>
                      <div className="theme-switch__spot"></div>
                      <div className="theme-switch__spot"></div>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          </li>
          <li className="header__item">
            <p>ITEM</p>
          </li>
          <li className="header__item">
            <p>ITEM</p>
          </li>
          <li className="header__item">
            <p>ITEM</p>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HeaderBottom;
