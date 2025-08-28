import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Получить области Meest
router.post('/meest-areas', async (req, res) => {
  try {
    const apiRes = await fetch(
      'https://api.meest.com/v3.0/openAPI/regionSearch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          token: "poa2e4f7702c8a378827161039b3d8a5",
        },
        body: JSON.stringify({
          filters: {
            countryID: 'c35b6195-4ea3-11de-8591-001d600938f8',
            countryDescr: 'УКРАЇНА',
          },
        }),
      }
    );

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      return res.status(apiRes.status).json({ message: errorText || 'Помилка на Meest API' });
    }

    const data = await apiRes.json();
    console.log('Ответ от Meest API (areas):', data);
    res.json(data.result || data);
  } catch (error) {
    console.error('Meest Areas Error:', error);
    res.status(500).json({ message: 'Внутрішня помилка сервера' });
  }
});

// Получить города Meest по regionId
router.post('/meest-cities', async (req, res) => {
  const { regionId } = req.body;
  if (!regionId) {
    return res.status(400).json({ error: 'Не вказано regionId' });
  }

  try {
    const apiRes = await fetch(
      'https://api.meest.com/v3.0/openAPI/citySearch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          token: "poa2e4f7702c8a378827161039b3d8a5",
        },
        body: JSON.stringify({
          filters: { regionID: regionId },
          isDirectory: true,
        }),
      }
    );

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      return res.status(apiRes.status).json({ error: errorText });
    }

    const data = await apiRes.json();
    console.log('Ответ от Meest API (cities):', data);
    res.json(data.result || data);
  } catch (error) {
    console.error('Meest Cities Error:', error);
    res.status(500).json({ error: 'Помилка при отриманні міст' });
  }
});

// Получить отделения Meest по cityId
router.post('/meest-branches', async (req, res) => {
  const { city_id } = req.body;
  if (!city_id) {
    return res.status(400).json({ error: 'Не вказано city_id' });
  }

  try {
    const apiRes = await fetch(
      'https://api.meest.com/v3.0/openAPI/branchSearch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          token: "poa2e4f7702c8a378827161039b3d8a5",
        },
        body: JSON.stringify({
          filters: { cityID: city_id },
          getCobranding: true,
        }),
      }
    );

    if (!apiRes.ok) {
      const errorText = await apiRes.text();
      return res.status(apiRes.status).json({ error: errorText });
    }

    const data = await apiRes.json();
    console.log('Ответ от Meest API (branches):', data);
    res.json(data.result || data);
  } catch (error) {
    console.error('Meest Branches Error:', error);
    res.status(500).json({ error: 'Помилка при отриманні відділень' });
  }
});

export default router;
