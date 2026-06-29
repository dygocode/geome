import { createRouter, createRoute, createRootRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Layout } from './components/Layout';
import { HomePage } from './routes/HomePage';
import { AnalysisPage } from './routes/AnalysisPage';
import { SubscribePage } from './routes/SubscribePage';

const rootRoute = createRootRoute({
  component: Layout,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  validateSearch: z.object({
    email: z.string().optional(),
  }),
});

const analysisRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/analysis',
  component: AnalysisPage,
  validateSearch: z.object({
    email: z.string().optional(),
  }),
});

const subscribeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/subscribe',
  component: SubscribePage,
  validateSearch: z.object({
    email: z.string().optional(),
  }),
});

const routeTree = rootRoute.addChildren([homeRoute, analysisRoute, subscribeRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
