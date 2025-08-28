import React, { useEffect } from "react";
import { useRouter } from "next/router";

import useMedia from "@shared/lib/useMedia";
import { getAllCategory, getProductsByType } from "@shared/index";
import Banner from "@widgets/Banner/ui/Banner";
import TxtContent from "@widgets/TxtContent/ui/TxtContent";

const HomePage = React.memo(({ categories, products, news }) => {
  const router = useRouter();
  const device = useMedia();

  return (
    <>
      <Banner />
      <div className="container">
        <TxtContent />
      </div>
    </>
  );
});

export default HomePage;
