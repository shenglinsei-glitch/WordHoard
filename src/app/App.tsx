import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WordListScreen } from './components/WordListScreen';
import { SearchScreen } from './components/SearchScreen';
import { WordAddScreen } from './components/WordAddScreen';
import { WordDetailScreen } from './components/WordDetailScreen';
import { WordEditScreen } from './components/WordEditScreen';
import { FlashcardScreen } from './components/FlashcardScreen';
import { Navigation } from './components/Navigation';
import { Word, Folder } from './types';

const WORDS_KEY = 'vocabulary-words';
const FOLDERS_KEY = 'vocabulary-folders';

// 初期データ
const initialWords: Word[] = [
  {
    id: '1',
    word: '友達',
    katakana: 'トモダチ',
    chinese: '朋友',
    english: 'friend',
    phonetic: '/frend/',
    otherTranslations: ['仲間', 'companion'],
    tags: ['名詞', '人'],
    folders: ['folder1'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    word: '勉強',
    katakana: 'ベンキョウ',
    chinese: '学习',
    english: 'study',
    phonetic: '/ˈstʌdi/',
    otherTranslations: ['学習', 'learning'],
    tags: ['名詞', '動詞'],
    folders: ['folder1'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    word: '美しい',
    katakana: 'ウツクシイ',
    chinese: '美丽',
    english: 'beautiful',
    phonetic: '/ˈbjuːtɪfəl/',
    tags: ['形容詞'],
    folders: ['folder2'],
    createdAt: new Date().toISOString(),
  },
];

const initialFolders: Folder[] = [
  {
    id: 'folder1',
    name: 'JLPT N5',
    parentId: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'folder2',
    name: 'JLPT N4',
    parentId: null,
    createdAt: new Date().toISOString(),
  },
];

function App() {
  const [words, setWords] = useState<Word[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  // === 新增：iOS 音频自动播放限制解锁逻辑 ===
  useEffect(() => {
    const unlockAudio = () => {
      const audio = new Audio();
      // 使用极短的静音音频 Base64
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=';
      
      audio.play()
        .then(() => {
          console.log('Audio Context Unlocked');
          // 解锁成功后移除事件监听，避免重复执行
          window.removeEventListener('click', unlockAudio);
          window.removeEventListener('touchstart', unlockAudio);
        })
        .catch((err) => {
          console.warn('Audio unlock failed:', err);
        });
    };

    // 监听用户第一次点击或触摸
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);
  
  // ローカルストレージからデータを読み込む
  useEffect(() => {
    const storedWords = localStorage.getItem(WORDS_KEY);
    const storedFolders = localStorage.getItem(FOLDERS_KEY);
    
    if (storedWords) {
      setWords(JSON.parse(storedWords));
    } else {
      setWords(initialWords);
    }

    if (storedFolders) {
      setFolders(JSON.parse(storedFolders));
    } else {
      setFolders(initialFolders);
    }
  }, []);

  // データをローカルストレージに保存
  useEffect(() => {
    if (words.length > 0) {
      localStorage.setItem(WORDS_KEY, JSON.stringify(words));
    }
  }, [words]);

  useEffect(() => {
    if (folders.length > 0) {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    }
  }, [folders]);

  // データエクスポート機能
  const handleExportData = () => {
    console.log('========== エクスポート開始 ==========');
    console.log('単語数:', words.length);
    console.log('フォルダ数:', folders.length);
    
    const data = {
      words,
      folders,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vocabulary-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('エクスポート完了');
    alert('データをエクスポートしました！');
  };

  // データインポート機能
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('========== インポート開始 ==========');
    console.log('イベント:', event);
    console.log('ファイル:', event.target.files);
    
    const file = event.target.files?.[0];
    if (!file) {
      console.log('ファイルが選択されていません');
      return;
    }

    console.log('ファイル名:', file.name);
    console.log('ファイルサイズ:', file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        console.log('読み込んだデータ:', data);

        // データ検証
        if (!data.words || !Array.isArray(data.words)) {
          alert('無効なデータ形式です。単語データが見つかりません。');
          return;
        }

        if (!data.folders || !Array.isArray(data.folders)) {
          alert('無効なデータ形式です。フォルダデータが見つかりません。');
          return;
        }

        // 確認ダイアログ
        const confirmMessage = `現在のデータを上書きしますか？\n\nインポートするデータ：\n・単語: ${data.words.length}件\n・フォルダ: ${data.folders.length}件\n\n現在のデータ：\n・単語: ${words.length}件\n・フォルダ: ${folders.length}件`;
        
        if (window.confirm(confirmMessage)) {
          setWords(data.words);
          setFolders(data.folders);
          localStorage.setItem(WORDS_KEY, JSON.stringify(data.words));
          localStorage.setItem(FOLDERS_KEY, JSON.stringify(data.folders));
          alert('データのインポートに成功しました！');
          console.log('インポート完了');
        }
      } catch (error) {
        alert('ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。');
        console.error('Import error:', error);
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  const handleAddWord = (wordData: Omit<Word, 'id' | 'createdAt'>) => {
    const newWord: Word = {
      ...wordData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setWords([...words, newWord]);
  };

  const handleAddWords = (wordsData: Omit<Word, 'id' | 'createdAt'>[]) => {
    const newWords: Word[] = wordsData.map((wordData, index) => ({
      ...wordData,
      id: (Date.now() + index).toString(),
      createdAt: new Date().toISOString(),
    }));
    setWords([...words, ...newWords]);
  };

  const handleUpdateWord = (id: string, wordData: Omit<Word, 'id' | 'createdAt'>) => {
    setWords(words.map((word) => 
      word.id === id 
        ? { ...word, ...wordData }
        : word
    ));
  };

  const handleDeleteWord = (id: string) => {
    setWords(words.filter((word) => word.id !== id));
  };

  const handleRemoveWordFromFolder = (wordId: string, folderId: string) => {
    setWords(words.map((word) => {
      if (word.id === wordId) {
        const updatedFolders = word.folders?.filter((id) => id !== folderId) || [];
        return {
          ...word,
          folders: updatedFolders.length > 0 ? updatedFolders : undefined,
        };
      }
      return word;
    }));
  };

  const handleAddFolder = (name: string, parentId: string | null) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      parentId,
      createdAt: new Date().toISOString(),
    };
    setFolders([...folders, newFolder]);
  };

  const handleUpdateFolder = (id: string, name: string) => {
    setFolders(folders.map((folder) =>
      folder.id === id
        ? { ...folder, name }
        : folder
    ));
  };
  const handleMoveFolder = (folderId: string, newParentId: string | null) => {
    setFolders(
      folders.map((f) =>
        f.id === folderId
          ? { ...f, parentId: newParentId ?? null }
          : f
      )
    );
  };

  const handleAddExistingWordsToFolder = (wordIds: string[], folderId: string) => {
    if (!folderId) return;
    const idSet = new Set(wordIds);
    setWords(
      words.map((w) => {
        if (!idSet.has(w.id)) return w;
        const prev = w.folders ?? [];
        if (prev.includes(folderId)) return w;
        return { ...w, folders: [...prev, folderId] };
      })
    );
  };

  const handleDeleteFolder = (id: string) => {
    // フォルダを削除し、そのフォダ内の単語のフォルダ参照を削除
    setWords(words.map((word) => ({
      ...word,
      folders: word.folders?.filter((folderId) => folderId !== id),
    })));

    // サブフォルダも再帰的に削除
    const deleteRecursive = (folderId: string) => {
      const childFolders = folders.filter((f) => f.parentId === folderId);
      childFolders.forEach((child) => {
        deleteRecursive(child.id);
        // 子フォルダの単語からも参照を削除
        setWords(words.map((word) => ({
          ...word,
          folders: word.folders?.filter((id) => id !== child.id),
        })));
      });
    };

    deleteRecursive(id);
    setFolders(folders.filter((folder) => folder.id !== id && folder.parentId !== id));
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route
            path="/"
            element={<Navigate to="/list" replace />}
          />
          <Route
            path="/list"
            element={
              <>
                <WordListScreen 
                  words={words} 
                  folders={folders}
                  onAddFolder={handleAddFolder}
                  onUpdateFolder={handleUpdateFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onRemoveWordFromFolder={handleRemoveWordFromFolder}
                  onExportData={handleExportData}
                  onImportData={handleImportData}
                  onMoveFolder={handleMoveFolder}
                  onAddExistingWordsToFolder={handleAddExistingWordsToFolder}
                />
                <Navigation />
              </>
            }
          />
          <Route
            path="/search"
            element={
              <>
                <SearchScreen words={words} />
                <Navigation />
              </>
            }
          />
          <Route
            path="/add"
            element={
              <>
                <WordAddScreen 
                  onAddWord={handleAddWord} 
                  onAddWords={handleAddWords}
                  existingWords={words}
                />
                <Navigation />
              </>
            }
          />
          <Route
            path="/detail/:id"
            element={
              <>
                <WordDetailScreen words={words} folders={folders} />
                <Navigation />
              </>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <>
                <WordEditScreen 
                  words={words} 
                  folders={folders}
                  onUpdateWord={handleUpdateWord} 
                  onDeleteWord={handleDeleteWord}
                  onAddFolder={handleAddFolder}
                  onRemoveWordFromFolder={handleRemoveWordFromFolder}
                />
                <Navigation />
              </>
            }
          />
          <Route
            path="/flashcard"
            element={
              <>
                <FlashcardScreen 
                  words={words} 
                  folders={folders} 
                  onUpdateWord={handleUpdateWord}
                />
                <Navigation />
              </>
            }
          />
          <Route path="*" element={<Navigate to="/list" replace />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;