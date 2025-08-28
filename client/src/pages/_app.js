import "../shared/lib/i18n";
import "../pages/styles/global.scss";

import { Provider } from "react-redux";
// import store from "@app/store";
import { useUtmTracking } from "../shared";
import { ModalsProvider } from "../shared/context/ModalsContext";
import { appWithTranslation } from "next-i18next";

// import { DataLoader } from "@app/loadingFromDBToRedux";
import { usePageLoading } from "@shared/model/usePageLoading";
import { cormorantInfant, montserratAlternates } from "@shared/style/font";
import Header from "@widgets/Header";
import Footer from "@widgets/Footer";

function MyApp({ Component, pageProps }) {
  const loading = usePageLoading();

  const getLayout =
    Component.getLayout ??
    ((page) => (
      <div
        className={`layout  ${montserratAlternates.variable} ${cormorantInfant.variable}`}
      >
        <Header {...pageProps} />
        {/* <DataLoader /> */}
        <main className="main">{page}</main>
        <Footer {...pageProps} />
      </div>
    ));

  return (
    <>
      {/* <Provider store={store}> */}
      <ModalsProvider>{getLayout(<Component {...pageProps} />)}</ModalsProvider>
      {/* </Provider> */}
    </>
  );
}

export default appWithTranslation(MyApp);
