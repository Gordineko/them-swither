import Image from "next/image";
import Instagram from "@shared/icons/Instagram";
import Telegram from "@shared/icons/Telegram";
import FaceBook from "@shared/icons/FaceBook";
import TikTok from "@shared/icons/TikTok";
import { useState } from "react";

const Footer = ({ categories }) => {
  const [isOpen, setIsOpen] = useState();
  return <footer className="footer container"></footer>;
};

export default Footer;
