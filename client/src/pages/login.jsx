// pages/login.js
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Box, Paper, Typography, TextField, Button } from '@mui/material';

const LoginPage = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/api/login`,
        { username, password },
        { withCredentials: true }
      );

      router.push("/panel5587436");
    } catch (err) {
      console.error('Login error:', err.response?.data);
      setError(err.response?.data?.message || 'Помилка входу');
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}
    >
      <Paper sx={{ p: 4, width: '400px' }}>
        <Typography variant="h5" gutterBottom>
          Вхід в систему
        </Typography>
        {error && <Typography sx={{ color: 'red' }}>{error}</Typography>}
        <form onSubmit={handleLogin}>
          <TextField
            label="Логін"
            variant="outlined"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Пароль"
            type="password"
            variant="outlined"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
            Увійти
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

// 👇 Это отключает обёртку с Header/Footer
LoginPage.getLayout = (page) => page;

export default LoginPage;
