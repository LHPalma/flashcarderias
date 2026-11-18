import { HashRouter, Route, Routes } from 'react-router-dom';
import { DecksPage } from './pages/DecksPage';
import { DeckPage } from './pages/DeckPage';
import { StudyPage } from './pages/StudyPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DecksPage />} />
        <Route path="/deck/:id" element={<DeckPage />} />
        <Route path="/study/:id" element={<StudyPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<DecksPage />} />
      </Routes>
    </HashRouter>
  );
}
