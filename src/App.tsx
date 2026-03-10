import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import { LoginScreen } from './components/login-screen';
import { AppProvider } from './context/app-context';
import { AuthProvider, useAuth } from './context/auth-context';
import { AssetsPage } from './pages/assets-page';
import { BatchTestPage } from './pages/batch-test-page';
import { ModelsPage } from './pages/models-page';
import { PromptDetailPage } from './pages/prompt-detail-page';
import { PromptsPage } from './pages/prompts-page';

function AuthenticatedApp() {
  const { user, loading, errorMessage, login } = useAuth();

  if (loading || !user) {
    return <LoginScreen loading={loading} errorMessage={errorMessage} onLogin={login} />;
  }

  return (
    <AppProvider key={user.id} storageKey={`promptlab-state-user:${user.id}`}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<PromptsPage />} />
          <Route path="prompts/:projectId" element={<PromptDetailPage />} />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="batch-test" element={<BatchTestPage />} />
          <Route path="history" element={<Navigate to="/batch-test" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </BrowserRouter>
  );
}
