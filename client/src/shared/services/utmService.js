import { useEffect } from "react";
import { useRouter } from "next/router";
import { parseUtm } from "../lib/parseUtm";
import { saveUtmToStorage } from "../lib/saveUtmToStorage";
import { getUtmFromStorage } from "../lib/getUtmFromStorage";

export const useUtmTracking = () => {
  const router = useRouter();

  useEffect(() => {
    const utm = parseUtm(router.query);

    // Проверяем, есть ли UTM-параметры в ссылке
    const hasUtmInUrl = Object.values(utm).some(
      (value) => value
    );

    // Если в ссылке есть UTM-параметры и их нет в куки
    if (hasUtmInUrl) {
      const utmFromCookies = getUtmFromStorage();
      const isUtmInCookies = Object.values(
        utmFromCookies
      ).some((value) => value);

      // Если UTM-метки нет в куки, отправляем их на сервер и сохраняем в куки
      if (!isUtmInCookies) {
        sendUtmAnalytics(utm);
        saveUtmToStorage(utm); // Сохраняем в куки
      }
    }
  }, [router.query]);
};

export const sendUtmAnalytics = async (utm) => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/utm/register-utm",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(utm),
      }
    );

    if (!response.ok) {
      throw new Error(
        "Failed to send UTM analytics"
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(
      "Error sending UTM analytics:",
      error
    );
    throw error;
  }
};
