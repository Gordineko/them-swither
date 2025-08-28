export const getReviewById = async (id) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/reviews/get-reviews/${id}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch product with ID: ${id}`
      );
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(
      `Error fetching product by ID (${id}):`,
      e
    );
    throw e;
  }
};

export const sendReview = async ({
  firstName,
  comment,
  rating,
  productId,
}) => {
  const payload = {
    author: firstName,
    comment,
    rating,
    product: productId,
  };

  const response = await fetch(
    "http:// 192.168.0.106:5002/api/reviews/post-reviews",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw new Error("Ошибка при отправке отзыва");
  }

  return await response.json();
};
