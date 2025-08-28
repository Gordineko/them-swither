import axios from "axios";

const NP_API_KEY = "6ac96c751e3eb13a5d552f8f50248575";
const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";
/**
 * Возвращает данные города (включая область) по его Ref
 * @param {string} cityRef
 * @returns {Promise<{ city: string, region: string }|null>}
 */

export async function fetchNpAreaByRef(areaRef) {
  try {
    const { data } = await axios.post(NP_API_URL, {
      apiKey: NP_API_KEY,
      modelName: "Address",
      calledMethod: "getAreas",
      methodProperties: { Ref: areaRef },
    });
    if (data.success && data.data.length) {
      return data.data[0].Description;
    }
  } catch (err) {
    console.error("NP getAreas error:", err.response?.data || err.message);
  }
  return null;
}

export async function fetchNpCityAndRegionByRef(cityRef) {
  try {
    const { data } = await axios.post(NP_API_URL, {
      apiKey: NP_API_KEY,
      modelName: "Address",
      calledMethod: "getCities",
      methodProperties: { Ref: cityRef },
    });
    if (data.success && data.data.length) {
      const cityObj = data.data[0];
      return {
        city: cityObj.Description,            // название города
        region: cityObj.AreaDescription,      // область
      };
    }
    return null;
  } catch (err) {
    console.error("NP getCities error:", err.response?.data || err.message);
    return null;
  }
}

/**
 * Возвращает данные отделения по его Ref
 * @param {string} warehouseRef
 * @returns {Promise<{ branch: string }|null>}
 */
export async function fetchNpWarehouseByRef(warehouseRef) {
  try {
    const { data } = await axios.post(NP_API_URL, {
      apiKey: NP_API_KEY,
      modelName: "AddressGeneral",
      calledMethod: "getWarehouses",
      methodProperties: { Ref: warehouseRef },
    });
    if (data.success && data.data.length) {
      const wh = data.data[0];
      return {
        branch: `${wh.Description} (№${wh.Number})`, // например: "Отделение №5"
      };
    }
    return null;
  } catch (err) {
    console.error("NP getWarehouses error:", err.response?.data || err.message);
    return null;
  }
}
