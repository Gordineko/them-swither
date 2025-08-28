export const sendForm = async ({
  name,
  phone,
  question,
  product,
  formType,
}) => {
  try {
    const res = await fetch(
      "http:// 192.168.0.106:5002/api/bid/create-bid",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          question,
          product,
          formType,
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(
        errorData.message ||
          "Ошибка отправки формы"
      );
    }

    return await res.json();
  } catch (error) {
    console.error(
      "Ошибка при отправке:",
      error.message
    );
    throw error;
  }
};
