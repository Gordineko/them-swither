import React, { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  ModalsProvider,
  useModals,
} from "../shared/context/ModalsContext";
import Cookies from "js-cookie";
import store from "@app/store";

import { Provider } from "react-redux";
import Breadcrumbs from "@widgets/Breadcrumbs/ui/Breadcrumbs";
import Title from "@widgets/CatalogPage/Title/ui/Title";
import { useTranslation } from "react-i18next";
import DashboardSidebar from "@widgets/Dashboard/ui/DashboardSidebar";
import LogoutModal from "@widgets/Dashboard/ui/LogoutModal";
import LoginModal from "@features/modals/Login/ui/LoginModal";
import FormComlited from "@widgets/Dashboard/ui/FormComlited";

const DashboardLayout = ({
  children,
  header,
  user,
}) => {
  const { t } = useTranslation();
  // const router = useRouter();
  const { locale } = useRouter();
  const isPartner = Cookies.get("isPartner");
  const headerClass = "header active func";
  console.log(user);
  return (
    <>
      <Provider store={store}>
        <ModalsProvider>
          <main className="main">
            <FormComlited />
            <LoginModal />
            <LogoutModal />
            <div className="container profile">
              <div className="profile__preview">
                <Breadcrumbs
                  pageName={t("Header.profile")}
                />
                <Title
                  title={t("Header.profile")}
                />
              </div>
              {isPartner === true ? (
                <div className="profile__discount">
                  <span>
                    <b>
                      {locale === "ru"
                        ? "Партнёрская скидка: "
                        : "Партнерська знижка: "}
                    </b>

                    {locale === "ru"
                      ? "Купите на сумму 200$, чтобы получить 5% скидки:"
                      : "Купіть на суму 200$, щоб отримати 5% знижки:"}
                  </span>
                </div>
              ) : (
                <div className="profile__discount">
                  <span>
                    <b>
                      {locale === "ru"
                        ? "Накопительная система : "
                        : "Накопичувальна система: "}
                    </b>

                    {locale === "ru"
                      ? `Вы уже купили на сумму ${user.totalSpent.toFixed(
                          2
                        )} грн. Ваша текущая скидка: ${
                          user.discount
                        }%.`
                      : `Ви вже купили на суму ${user.totalSpent.toFixed(
                          2
                        )} грн. Ваша поточна знижка: ${
                          user.discount
                        }%.`}
                  </span>
                </div>
              )}

              <div className={"profile__wrapper"}>
                <DashboardSidebar />

                {children}
              </div>
            </div>
          </main>
        </ModalsProvider>
      </Provider>
    </>
  );
};

export default DashboardLayout;
