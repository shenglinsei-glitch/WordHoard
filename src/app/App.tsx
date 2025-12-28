import { useState, useEffect, ChangeEvent } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; 
import { WordListScreen } from './components/WordListScreen';
import { SearchScreen } from './components/SearchScreen';
import { WordAddScreen } from './components/WordAddScreen';
import { WordDetailScreen } from './components/WordDetailScreen';
import { WordEditScreen } from './components/WordEditScreen';
import { FlashcardScreen } from './components/FlashcardScreen';
import { Navigation } from './components/Navigation'; // 确保导入了导航栏
import { Word, Folder } from './types';

function App() {
  const [words, setWords] = useState<Word[]>(() => {
    try {
      const raw = localStorage.getItem('words');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    try {
      const raw = localStorage.getItem('folders');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('words', JSON.stringify(words));
  }, [words]);

  useEffect(() => {
    localStorage.setItem('folders', JSON.stringify(folders));
  }, [folders]);

  const handleAddFolder = (name: string, parentId: string | null) => {
    const newFolder: Folder = { id: Date.now().toString(), name, parentId, createdAt: new Date().toISOString() };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleUpdateFolder = (id: string, name: string) => {
    setFolders(prev => prev.map(f => (f.id === id ? { ...f, name } : f)));
  };

  const handleDeleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    setWords(prev => prev.map(w => ({ ...w, folders: (w.folders || []).filter(fid => fid !== id) })));
  };

  const handleRemoveWordFromFolder = (wordId: string, folderId: string) => {
    setWords(prev => prev.map(w => (w.id === wordId ? { ...w, folders: (w.folders || []).filter(fid => fid !== folderId) } : w)));
  };

  const handleAddWord = (word: Omit<Word, 'id' | 'createdAt'>) => {
    const newWord: Word = { ...word, id: Date.now().toString(), createdAt: new Date().toISOString() };
    setWords(prev => [...prev, newWord]);
  };

  const handleAddWords = (newWords: Omit<Word, 'id' | 'createdAt'>[]) => {
    const wordsWithMetadata: Word[] = newWords.map(word => ({ ...word, id: (Date.now() + Math.random()).toString(), createdAt: new Date().toISOString() }));
    setWords(prev => [...prev, ...wordsWithMetadata]);
  };

  const handleUpdateWord = (updated: Word) => {
    setWords(prev => prev.map(w => (w.id === updated.id ? updated : w)));
  };

  const handleUpdateWordForEdit = (id: string, word: Omit<Word, 'id' | 'createdAt'>) => {
    const existingWord = words.find(w => w.id === id);
    const updated: Word = { ...word, id, createdAt: existingWord?.createdAt || new Date().toISOString() };
    handleUpdateWord(updated);
  };

  const handleDeleteWord = (id: string) => {
    setWords(prev => prev.filter(w => w.id !== id));
  };

  const handleExportData = () => {
    const data = JSON.stringify({ words, folders }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jici-export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          if (Array.isArray(parsed.words)) setWords(parsed.words);
          if (Array.isArray(parsed.folders)) setFolders(parsed.folders);
        } catch (e) { console.error('import failed', e); }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20"> {/* 添加底部间距防止被导航栏挡住 */}
      <Routes>
        <Route path="/" element={<Navigate to="/list" replace />} />
        <Route path="/list" element={<WordListScreen words={words} folders={folders} onAddFolder={handleAddFolder} onUpdateFolder={handleUpdateFolder} onDeleteFolder={handleDeleteFolder} onRemoveWordFromFolder={handleRemoveWordFromFolder} onExportData={handleExportData} onImportData={handleImportData} />} />
        <Route path="/search" element={<SearchScreen words={words} />} />
        <Route path="/add" element={<WordAddScreen onAddWord={handleAddWord} onAddWords={handleAddWords} existingWords={words} />} />
        <Route path="/detail/:id" element={<WordDetailScreen words={words} folders={folders} />} />
        <Route path="/edit/:id" element={<WordEditScreen words={words} onUpdateWord={handleUpdateWordForEdit} folders={folders} onDeleteWord={handleDeleteWord} onAddFolder={handleAddFolder} onRemoveWordFromFolder={handleRemoveWordFromFolder} />} />
        <Route path="/flashcard" element={<FlashcardScreen words={words} folders={folders} onUpdateWord={handleUpdateWordForEdit} />} />
      </Routes>
      <Navigation /> {/* 确保导航栏在所有页面都显示 */}
    </div>
  );
}

export default App;