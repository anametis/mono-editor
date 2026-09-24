import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const Editorial = lazy(() =>
  import("./features/content/editorial").then((m) => ({
    default: m.Editorial,
  })),
);
const Account = lazy(() =>
  import("./routes/account").then((m) => ({ default: m.Account })),
);
import "@kara/tokens/styles.css";
const queryClient = new QueryClient();
const root = createRootRoute({
  component: () => (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <a className="brand" href="/">
          Kara / editorial
        </a>
        <a href="/account">Account & security</a>
      </header>
      <main id="main" className="shell">
        <Suspense fallback={<p role="status">Loading workspace…</p>}>
          <RouterOutlet />
        </Suspense>
      </main>
    </>
  ),
});
import { Outlet as RouterOutlet } from "@tanstack/react-router";
const index = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: Editorial,
});
const account = createRoute({
  getParentRoute: () => root,
  path: "/account",
  component: Account,
});
const router = createRouter({ routeTree: root.addChildren([index, account]) });
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
