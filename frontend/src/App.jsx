/**
 * App.jsx — shell da aplicação
 * Responsável apenas por: context provider, loading, wizard gate, routing.
 */

import G from "./styles.jsx";
import { AppProvider, useApp } from "./context.jsx";
import { Spinner } from "./components/common.jsx";
import Wizard from "./components/Wizard.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import FilesPage from "./pages/Files.jsx";
import BackupPage from "./pages/Backup.jsx";
import ToolsPage from "./pages/Tools.jsx";
import ActivityPage from "./pages/Activity.jsx";
import SettingsPage from "./pages/Settings.jsx";

function AppInner() {
  const { setup, checking, page, set, backupRunning, user } = useApp();

  if (checking) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <Spinner size={28} />
    </div>
  );

  if (setup) return <Wizard onDone={() => set({ setup: false })} />;

  return (
    <Layout page={page} setPage={(p) => set({ page: p })} backupRunning={backupRunning} user={user}>
      {page === "dashboard" && <Dashboard />}
      {page === "files"     && <FilesPage />}
      {page === "backup"    && <BackupPage />}
      {page === "tools"     && <ToolsPage />}
      {page === "activity"  && <ActivityPage />}
      {page === "settings"  && <SettingsPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <G />
      <AppInner />
    </AppProvider>
  );
}
