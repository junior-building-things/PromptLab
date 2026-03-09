import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/app-layout';
import { AppProvider } from './context/app-context';
import { AssetsPage } from './pages/assets-page';
import { BatchTestPage } from './pages/batch-test-page';
import { HistoryPage } from './pages/history-page';
import { ModelsPage } from './pages/models-page';
import { PromptDetailPage } from './pages/prompt-detail-page';
import { PromptsPage } from './pages/prompts-page';

export function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<PromptsPage />} />
            <Route path="prompts/:projectId" element={<PromptDetailPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="models" element={<ModelsPage />} />
            <Route path="batch-test" element={<BatchTestPage />} />
            <Route path="history" element={<HistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
