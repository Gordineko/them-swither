import { useRouter } from "next/router";
import React from "react";
import Image from "next/image";
import Head from "next/head";

const _404 = () => {
  const router = useRouter();
  return (
    <>
      {" "}
      <Head>
        <title> LEDTech — 404</title>
        <meta
          name="robots"
          content="noindex, nofollow"
        />
        <meta
          name="googlebot"
          content="noindex, nofollow"
        />
        <link
          rel="icon"
          href="/img/logo-google.ico"
          type="image/x-icon"
        />
        <meta
          name="description"
          content="PowerPro — магазин спортивного питания. Доступ к корзине или личному кабинету."
        />
        <meta
          property="og:title"
          content={`LEDTech — 404`}
        />
        <meta
          property="og:description"
          content="PowerPro — магазин спортивного питания"
        />
        <meta
          property="og:type"
          content="website"
        />
        <meta
          property="og:image"
          content="http:// 192.168.0.106:5002/img/logo-google.png"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />
        <meta
          name="format-detection"
          content="telephone=no"
        />
      </Head>
      <section className="page_404">
        <Image
          src="/img/404.png"
          alt="404"
          width={585}
          height={335}
        />

        <h1>На цій сторінці світла немає...</h1>
        <p>
          Але наш магазин і далі світиться для вас
        </p>
        <button
          onClick={() => {
            router.push("/");
          }}
        >
          Повернутись на головну сторінку
        </button>
      </section>
    </>
  );
};

_404.getLayout = (page) => page; // Убирает обёртку с Header/Footer, если нужно

export default _404;
