import Cookies from "js-cookie";

export const login = async ({
  email,
  password,
}) => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/auth/login-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || "Failed to login"
      );
    }

    const data = await response.json();

    // Сохраняем токен в куки
    Cookies.set("auth_token", data.token, {
      expires: 7,
    });
    Cookies.set("profile_id", data.id, {
      expires: 7,
    });
    Cookies.set("isPartner", data.isPartner, {
      expires: 7,
    });
    Cookies.set("discount", data.discount, {
      expires: 7,
    });

    return data;
  } catch (e) {
    console.error(
      "Error during login:",
      e.message
    );
    throw e;
  }
};

export const logout = async () => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/auth/logout-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Cookies.get(
            "auth_token"
          )}`,
        },
      }
    );

    if (response.ok) {
      Cookies.remove("auth_token");
      Cookies.remove("profile_id");
      Cookies.remove("isPartner");
    } else {
      console.error(
        "Logout failed:",
        response.statusText
      );
    }
  } catch (error) {
    console.error("Error logging out:", error);
  }
};

export const registration = async ({
  email,
  firstname,
  password,
}) => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/auth/register-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          firstname,
          password,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || "Failed to register user"
      );
    }

    const data = await response.json();
    return data; // Возвращаем ответ от сервера
  } catch (e) {
    console.error(
      "Error during registration:",
      e
    );
    throw e;
  }
};

export const getWishlist = async (id) => {
  try {
    const response = await fetch(
      `http:// 192.168.0.106:5002/api/wishlist/get-wishlist?userId=${id}`,
      {
        method: "GET", // Меняем на POST, т.к. body в GET запросе не передаётся
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      }
    );

    if (!response.ok) {
      throw new Error(
        `Ошибка: ${response.status}`
      );
    }

    const data = await response.json();

    return data.wishlist || []; // Возвращаем пустой массив, если нет данных
  } catch (error) {
    console.error(
      "Ошибка при получении wishlist:",
      error
    );
    return []; // Возвращаем [] вместо `undefined`
  }
};

export const addWishList = async (id, prodId) => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/wishlist/add-to-wishlist",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: id,
          productId: prodId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || "Failed to register user"
      );
    }

    const data = await response.json();
    return data; // Возвращаем ответ от сервера
  } catch (e) {
    console.error(
      "Error during registration:",
      e
    );
    throw e;
  }
};

export const removeWishList = async (
  id,
  prodId
) => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/wishlist/remove-from-wishlist",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: id,
          productId: prodId,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message ||
          "Failed to remove product from wishlist"
      );
    }

    const data = await response.json();
    return data; // Возвращаем ответ от сервера
  } catch (e) {
    console.error(
      "Ошибка при удалении из wishlist:",
      e
    );
    throw e;
  }
};

// feedback

export const feedback = async ({
  client_name,
  phone,
  comment,
}) => {
  try {
    const response = await fetch(
      "http:// 192.168.0.106:5002/api/message/create-message",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_name,
          phone,
          comment,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.message || "Failed to rfeedback"
      );
    }

    const data = await response.json();
    return data; // Возвращаем ответ от сервера
  } catch (e) {
    console.error("Error feedback:", e);
    throw e;
  }
};
