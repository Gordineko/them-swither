import HeaderTop from "./common/HeaderTop";
import HeaderBottom from "./common/HeaderBottom";
import useMedia from "@shared/lib/useMedia";

const Header = ({ categories }) => {
  const device = useMedia();
  return (
    <>
      <header
        className={`header ${
          device === "little-tablet" || device === "mobile" ? "sticky" : ""
        }`}
      >
        <HeaderTop />
        <HeaderBottom categories={categories} />
      </header>
    </>
  );
};

export default Header;
