import jwt from 'jsonwebtoken';
const JWT_SECRET = 'your_jwt_secret_key';

export const authenticateToken = (req, res, next) => {
    console.log("DEBUG: Все заголовки запроса:", req.headers);
  
    const authHeader = req.header('Authorization');
    console.log("DEBUG: Получен заголовок Authorization:", authHeader);
  
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("DEBUG: Токен отсутствует или имеет неверный формат");
      return res.status(401).json({ message: 'Немає доступу' });
    }
  
    const token = authHeader.split(' ')[1];
    console.log("DEBUG: Извлечённый токен:", token);
  
    try {
      const verified = jwt.verify(token, JWT_SECRET);
      console.log("DEBUG: Токен успешно верифицирован:", verified);
      req.user = verified;
      next();
    } catch (err) {
      console.error("DEBUG: Ошибка верификации токена:", err);
      res.status(401).json({ message: 'Токен недійсний або закінчився' });
    }
  };
  

