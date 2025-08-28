// styles/fonts.js
import { Montserrat_Alternates, Cormorant_Infant } from "next/font/google";

export const montserratAlternates = Montserrat_Alternates({
  subsets: ["latin", "cyrillic"],
  weight: ["100", "300", "400", "500", "700", "900"],
  display: "swap",
});

export const cormorantInfant = Cormorant_Infant({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
