import { User } from "../models/User.js";

export const usePromoCode = async (req, res) => {
    try {
        const { userId, title } = req.body;
        console.log(userId)
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        const promo = user.promoCodes.find((promo) => promo.title === title);
        if (!promo) {
            return res.status(404).json({ message: "Промокод не найден" });
        }


        // Проверка срока действия и доступного количества
        if (new Date(promo.validUntil) < new Date()) {
            return res.status(400).json({ message: "Промокод истёк" });
        }

        if (promo.quantity <= 0) {
            return res.status(400).json({ message: "Промокод недоступен" });
        }

        // Используем промокод – уменьшаем количество
        promo.quantity -= 1;
        await user.save();

        return res.status(200).json({ message: "Промокод использован", promoCode: promo });
    } catch (error) {
        console.error("Ошибка при использовании промокода:", error.message);
        return res.status(500).json({ message: "Ошибка сервера", error: error.message });
    }
};