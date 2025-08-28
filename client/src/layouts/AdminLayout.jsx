// components/AdminLayout.js
import React from 'react';
import Link from 'next/link';
import {
  AppBar, Toolbar, Typography, Drawer, List,
  ListItemButton, ListItemText, CssBaseline, Box
} from '@mui/material';

const drawerWidth = 180; // было 240 — делаем уже

const AdminLayout = ({ children }) => {
  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "#fea53f"
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{
              backgroundColor: "#fff",
              p: "4px",
              borderRadius: "4px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: "flex",
              alignItems: "center",
            }} />
            <Typography variant="h6" noWrap sx={{ ml: 2, color: "#fff" }}>
              Адмін панель
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar />
        <List dense> {/* более плотный список */}
          <Link href="/panel5587436/products" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText
                  primary="Товари"
                  primaryTypographyProps={{ fontSize: 14 }}
                />
              </ListItemButton>
            </a>
          </Link>

          <Link href="/panel5587436/categories" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText primary="Категорії" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </a>
          </Link>

          <Link href="/panel5587436/users" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText primary="Користувачі" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </a>
          </Link>

          <Link href="/panel5587436/orders" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText primary="Замовлення" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </a>
          </Link>

          <Link href="/panel5587436/posts" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText primary="Блог" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </a>
          </Link>

          <Link href="/panel5587436/reviews" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText primary="Відгуки" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </a>
          </Link>

          <Link href="/panel5587436/characteristics" passHref legacyBehavior>
            <a style={{ textDecoration: 'none', color: 'inherit' }}>
              <ListItemButton sx={{ py: 0.75, px: 2 }}>
                <ListItemText primary="Характеристики" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </a>
          </Link>
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: "#fff" }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default AdminLayout;
