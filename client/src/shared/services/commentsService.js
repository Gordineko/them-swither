export const getAllComments = async (id) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/reviews/get-reviews/${id}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch comments");
    }

    const data = await response.json();

    // Фильтруем только видимые комментарии
    const visibleComments = data.filter(
      (comment) => comment.isVisible === true
    );

    return visibleComments;
  } catch (e) {
    console.error("Error fetching comments:", e);
    throw e;
  }
};

export const addComment = async (comments) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/reviews/post-reviews`,

      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author: comments.author,
          rating: comments.rating,
          comment: comments.comment,
          product: comments.product,
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to post comment");
    }

    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Error posting comment:", e);
    throw e;
  }
};
