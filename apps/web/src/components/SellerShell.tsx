'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  FolderTree,
  Home,
  LogOut,
  Menu,
  Package,
  Palette,
  Percent,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import type { StoreSummaryDto } from '@tuvitrina/contracts';
import { useAuth } from '@/components/ThemeAndQueryProvider';
import {
  ErrorStateCard,
  OfflineBanner,
  PageSkeleton,
} from '@/components/StateViews';
import { ES_CU } from '@/lib/i18n/es-cu';

const DRAWER_WIDTH = 252;
const RAIL_WIDTH = 88;

const NAV_ITEMS = [
  { href: '/panel', label: ES_CU.nav.home, icon: Home, exact: true },
  { href: '/panel/productos', label: ES_CU.nav.products, icon: Package, exact: false },
  { href: '/panel/categorias', label: ES_CU.nav.categories, icon: FolderTree, exact: false },
  { href: '/panel/pedidos', label: 'Pedidos', icon: ShoppingBag, exact: false },
  { href: '/panel/marketing', label: 'Promos y Cupones', icon: Percent, exact: false },
  { href: '/panel/estadisticas', label: 'Estadísticas', icon: BarChart3, exact: false },
  { href: '/panel/clientes', label: 'Clientes', icon: Users, exact: false },
  { href: '/panel/personalizacion', label: 'Apariencia y QR', icon: Palette, exact: false },
  { href: '/panel/suscripcion', label: 'Suscripción', icon: Sparkles, exact: false },
  { href: '/panel/negocio', label: ES_CU.nav.business, icon: StoreIcon, exact: false },
] as const;

const MOBILE_PRIMARY_HREFS = ['/panel', '/panel/productos', '/panel/pedidos', '/panel/negocio'];

export function SellerShell({
  title,
  children,
}: {
  title: string;
  children: (store: StoreSummaryDto) => React.ReactNode;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg'));
  const isMobile = !isDesktop && !isTablet;

  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, supabaseReady, apiClient, signOut } = useAuth();
  const [offline, setOffline] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && supabaseReady && !user) {
      router.replace('/entrar');
    }
  }, [authLoading, supabaseReady, user, router]);

  const meQuery = useQuery({
    queryKey: ['seller-me', user?.id],
    enabled: Boolean(user),
    queryFn: () => apiClient.getMe(),
  });

  useEffect(() => {
    if (meQuery.data && !meQuery.data.store) {
      router.replace('/onboarding');
    }
  }, [meQuery.data, router]);

  const mobileItems = NAV_ITEMS.filter((i) => MOBILE_PRIMARY_HREFS.includes(i.href));
  const activeMobileIdx = mobileItems.findIndex((item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href),
  );
  const activeBottomValue = activeMobileIdx >= 0 ? activeMobileIdx : 4;

  const handleSignOut = async () => {
    await signOut();
    router.replace('/entrar');
  };

  const renderDrawerList = (onNavigate?: () => void) => (
    <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={selected}
            onClick={onNavigate}
            sx={{ borderRadius: 3, mb: 0.5, minHeight: 44 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon size={19} />
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: selected ? 700 : 500 }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );

  const renderDesktopDrawer = (store?: StoreSummaryDto) => (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: `1px solid ${theme.palette.divider}`,
          px: 1.5,
          py: 2,
        },
      }}
    >
      <Stack spacing={0.5} px={1.5} pb={2}>
        <Typography variant="h6" color="primary.main">
          {ES_CU.brand}
        </Typography>
        <Typography variant="subtitle2" noWrap>
          {store?.name ?? 'Mi tienda'}
        </Typography>
        {store ? (
          <Typography variant="caption" color="text.secondary">
            Plan {store.plan.toUpperCase()} · /{store.slug}
          </Typography>
        ) : null}
      </Stack>
      <Divider sx={{ mb: 1 }} />
      {renderDrawerList()}
      {meQuery.data?.profile?.role === 'admin' || meQuery.data?.profile?.role === 'support' ? (
        <ListItemButton
          component={Link}
          href="/admin"
          sx={{
            borderRadius: 3,
            mb: 1,
            bgcolor: 'primary.50',
            border: '1px dashed',
            borderColor: 'primary.main',
          }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <ShieldCheck size={19} color="#00796B" />
          </ListItemIcon>
          <ListItemText
            primary="Backoffice Admin"
            secondary={`Rol: ${meQuery.data.profile.role}`}
            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
            secondaryTypographyProps={{ fontSize: '0.75rem' }}
          />
        </ListItemButton>
      ) : null}
      <Button
        variant="text"
        color="inherit"
        startIcon={<LogOut size={18} />}
        onClick={handleSignOut}
        sx={{ justifyContent: 'flex-start' }}
      >
        {ES_CU.nav.signOut}
      </Button>
    </Drawer>
  );

  const renderTabletRail = () => (
    <Paper
      square
      elevation={0}
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
      }}
    >
      <Typography variant="subtitle1" fontWeight={700} color="primary.main" mb={1.5}>
        TV
      </Typography>
      <Stack spacing={0.5} flexGrow={1} width="100%" px={0.75}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Tooltip key={item.href} title={item.label} placement="right">
              <Button
                component={Link}
                href={item.href}
                variant={selected ? 'contained' : 'text'}
                color={selected ? 'primary' : 'inherit'}
                sx={{
                  minWidth: 48,
                  minHeight: 48,
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.25,
                  py: 0.5,
                  fontSize: 10,
                  lineHeight: 1.1,
                }}
              >
                <Icon size={18} />
                <span style={{ maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label.split(' ')[0]}
                </span>
              </Button>
            </Tooltip>
          );
        })}
      </Stack>
      <Button
        variant="text"
        color="inherit"
        onClick={handleSignOut}
        aria-label={ES_CU.nav.signOut}
        sx={{ minWidth: 48, minHeight: 48, mt: 1 }}
      >
        <LogOut size={20} />
      </Button>
    </Paper>
  );

  const store = meQuery.data?.store ?? undefined;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? renderDesktopDrawer(store) : null}
      {isTablet ? renderTabletRail() : null}

      <Box
        component="main"
        id="contenido-principal"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          pb: isMobile ? 10 : 4,
        }}
      >
        {!isDesktop ? (
          <AppBar
            position="sticky"
            color="inherit"
            elevation={0}
            sx={{
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: 'background.paper',
            }}
          >
            <Toolbar sx={{ minHeight: 56, justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700} noWrap>
                  {title}
                </Typography>
                {store ? (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {store.name}
                  </Typography>
                ) : null}
              </Box>
              <Button
                size="small"
                color="inherit"
                onClick={handleSignOut}
                startIcon={<LogOut size={16} />}
                sx={{ minHeight: 44 }}
              >
                {ES_CU.nav.signOut}
              </Button>
            </Toolbar>
          </AppBar>
        ) : null}

        <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3 }, pt: { xs: 2, lg: 4 } }}>
          <OfflineBanner offline={offline} />

          {isDesktop ? (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              mb={3}
            >
              <Typography variant="h4">{title}</Typography>
            </Stack>
          ) : null}

          {!supabaseReady ? (
            <ErrorStateCard
              message={ES_CU.setupRequiredBody}
              onRetry={() => router.push('/entrar')}
            />
          ) : authLoading || meQuery.isLoading ? (
            <PageSkeleton />
          ) : meQuery.isError ? (
            <ErrorStateCard
              message={
                meQuery.error instanceof Error
                  ? meQuery.error.message
                  : 'Error de conexión con la API.'
              }
              onRetry={() => meQuery.refetch()}
            />
          ) : store ? (
            children(store)
          ) : (
            <PageSkeleton />
          )}
        </Box>
      </Box>

      {isMobile ? (
        <>
          <Paper
            elevation={3}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1100,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            <BottomNavigation showLabels value={activeBottomValue} sx={{ height: 62 }}>
              {mobileItems.map((item) => {
                const Icon = item.icon;
                return (
                  <BottomNavigationAction
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    icon={<Icon size={20} />}
                    sx={{ minWidth: 56, py: 1 }}
                  />
                );
              })}
              <BottomNavigationAction
                label="Más"
                icon={<Menu size={20} />}
                onClick={() => setMobileMoreOpen(true)}
                sx={{ minWidth: 56, py: 1 }}
              />
            </BottomNavigation>
          </Paper>

          <Drawer
            anchor="bottom"
            open={mobileMoreOpen}
            onClose={() => setMobileMoreOpen(false)}
            sx={{ '& .MuiDrawer-paper': { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2, maxHeight: '78vh' } }}
          >
            <Typography variant="subtitle1" fontWeight={700} px={1.5} pb={1}>
              Todas las herramientas
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {renderDrawerList(() => setMobileMoreOpen(false))}
            {meQuery.data?.profile?.role === 'admin' || meQuery.data?.profile?.role === 'support' ? (
              <ListItemButton
                component={Link}
                href="/admin"
                onClick={() => setMobileMoreOpen(false)}
                sx={{ borderRadius: 3, mt: 1, border: '1px dashed', borderColor: 'primary.main' }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ShieldCheck size={19} color="#00796B" />
                </ListItemIcon>
                <ListItemText primary="Backoffice Admin" />
              </ListItemButton>
            ) : null}
          </Drawer>
        </>
      ) : null}
    </Box>
  );
}
