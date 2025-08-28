export const getAllNews = async () => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/blog"
    );

    if (!response.ok) {
      throw new Error("Failed to fetch news");
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error("Error fetching all news:", e);
    throw e;
  }
};

export const getNewsBySlug = async (slug) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/blog/slug/${slug}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch PageNews");
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(
      "Error fetching all PageNews:",
      e
    );
    throw e;
  }
};
