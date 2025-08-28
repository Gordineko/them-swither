export const getAllCategory = async () => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/categories/get-categories"
    );
    if (!response.ok) {
      throw new Error("Failed to fetch category");
    }
    const data = await response.json();
    return data;
  } catch (e) {
    console.error(
      "Error fetching all category:",
      e
    );
    throw e;
  }
};
