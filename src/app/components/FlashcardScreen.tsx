import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import { Word, Folder } from '../types';

interface FlashcardScreenProps {
  words: Word[];
  folders: Folder[];
  onUpdateWord: (id: string, wordData: Omit<Word, 'id' | 'createdAt'>) => void;
}

type FrontDisplayType = 'japanese' | 'chinese' | 'english' | 'image';

export function FlashcardScreen({ words, folders, onUpdateWord }: FlashcardScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings state
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [frontDisplayType, setFrontDisplayType] = useState<FrontDisplayType>('japanese');

  // Initialize with all folders selected
  useEffect(() => {
    if (folders.length > 0 && selectedFolders.length === 0) {
      setSelectedFolders(folders.map((f) => f.id));
    }
  }, [folders]);

  // Calculate next review date based on difficulty
  const getNextReviewDate = (difficulty: 'hard' | 'good' | 'easy'): string => {
    const now = new Date();
    switch (difficulty) {
      case 'hard':
        now.setDate(now.getDate() + 1);
        break;
      case 'good':
        now.setDate(now.getDate() + 3);
        break;
      case 'easy':
        now.setDate(now.getDate() + 7);
        break;
    }
    return now.toISOString();
  };

  // Check if word should be reviewed today
  const shouldReviewToday = (word: Word): boolean => {
    if (!word.studyState) return true;
    if (word.studyState.difficulty === 'completed') return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextReviewDate = new Date(word.studyState.nextReviewDate);
    nextReviewDate.setHours(0, 0, 0, 0);

    return nextReviewDate <= today;
  };

  // Filter words based on selected folders and review date
  const getFilteredWords = () => {
    let filtered = words.filter((w) => w.word);

    if (selectedFolders.length > 0) {
      filtered = filtered.filter((w) => {
        if (!w.folders || w.folders.length === 0) {
          return selectedFolders.includes('no-folder');
        }
        return w.folders.some((folderId) => selectedFolders.includes(folderId));
      });
    }

    filtered = filtered.filter((w) => shouldReviewToday(w));
    return filtered;
  };

  const studyWords = getFilteredWords();
  const hasStudyWords = studyWords.length > 0;

  useEffect(() => {
    setIsFlipped(false);
  }, [currentIndex]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [selectedFolders, frontDisplayType]);

  useEffect(() => {
    // When the filtered list changes (e.g. last word completed), keep index valid
    if (!hasStudyWords) {
      setCurrentIndex(0);
      setIsFlipped(false);
      return;
    }
    if (currentIndex >= studyWords.length) {
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [hasStudyWords, studyWords.length, currentIndex]);

  // Get front content based on settings with fallback
  const getFrontContent = (word: Word): { type: string; content: any } => {
    const defaultOrder: FrontDisplayType[] = ['japanese', 'chinese', 'english', 'image'];
    const typesToTry = [frontDisplayType, ...defaultOrder.filter((t) => t !== frontDisplayType)];

    for (const type of typesToTry) {
      switch (type) {
        case 'japanese':
          if (word.word) return { type: 'japanese', content: word.word };
          break;
        case 'chinese':
          if (word.chinese) return { type: 'chinese', content: word.chinese };
          break;
        case 'english':
          if (word.english) return { type: 'english', content: word.english };
          break;
        case 'image':
          if (word.imageUrl) return { type: 'image', content: word.imageUrl };
          break;
      }
    }

    return { type: 'japanese', content: word.word || '???' };
  };

  const handleNext = (difficulty: 'hard' | 'good' | 'easy') => {
    if (!hasStudyWords || !currentWord) return;
    const word = currentWord;
    const currentState = word.studyState;

    let newDifficulty: 'hard' | 'good' | 'easy' | 'completed' = difficulty;
    let consecutiveEasyCount = 0;
    let consecutiveGoodCount = 0;

    if (currentState) {
      consecutiveEasyCount = currentState.consecutiveEasyCount;
      consecutiveGoodCount = currentState.consecutiveGoodCount;
    }

    if (difficulty === 'easy') {
      if (currentState?.difficulty === 'easy') {
        consecutiveEasyCount += 1;
        if (consecutiveEasyCount >= 2) {
          newDifficulty = 'completed';
        }
      } else {
        consecutiveEasyCount = 1;
      }
      consecutiveGoodCount = 0;
    } else if (difficulty === 'good') {
      if (currentState?.difficulty === 'good') {
        consecutiveGoodCount += 1;
        if (consecutiveGoodCount >= 2) {
          newDifficulty = 'easy';
          consecutiveGoodCount = 0;
        }
      } else {
        consecutiveGoodCount = 1;
      }
      consecutiveEasyCount = 0;
    } else {
      consecutiveEasyCount = 0;
      consecutiveGoodCount = 0;
    }

    const updatedWord = {
      ...word,
      studyState: {
        difficulty: newDifficulty,
        nextReviewDate:
          newDifficulty === 'completed'
            ? new Date('2099-12-31').toISOString()
            : getNextReviewDate(difficulty),
        consecutiveEasyCount,
        consecutiveGoodCount,
        lastReviewDate: new Date().toISOString(),
      },
    };

    onUpdateWord(word.id, updatedWord);

    if (currentIndex < studyWords.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const currentWord = hasStudyWords ? studyWords[currentIndex] : null;
  const totalWords = studyWords.length;
  const frontContent = currentWord ? getFrontContent(currentWord) : null;

  const cardShell =
    'h-full rounded-[40px] bg-white/80 backdrop-blur-xl ring-1 ring-black/5 shadow-[0_18px_55px_rgba(0,0,0,0.12)] overflow-hidden';
  const neutralMist =
    'absolute inset-0 bg-gradient-to-br from-white/75 via-white/45 to-transparent pointer-events-none';

  // ✅ border 제거 (회색 테두리 문제 해결)
  const tintButtonBase =
    'flex-1 py-4 rounded-2xl shadow-sm transition-colors active:translate-y-[1px] active:shadow-sm text-lg font-medium';

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 overflow-hidden">
      <div className="max-w-5xl mx-auto h-screen flex flex-col p-4">
        <div className="flex items-center justify-between mb-8 mt-6">
          <div className="bg-white/80 backdrop-blur-xl px-6 py-3 rounded-full shadow-md ring-1 ring-black/5">
            <span className="text-lg text-gray-700 font-medium">
              {hasStudyWords ? currentIndex + 1 : 0} / {totalWords}
            </span>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 bg-white/80 backdrop-blur-xl rounded-full shadow-md ring-1 ring-black/5 hover:bg-white transition-colors"
          >
            <Settings size={24} className="text-gray-700" />
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center perspective-1000 px-4">
          <div
            className="relative w-full h-full max-w-3xl max-h-[600px] transition-transform duration-500 transform-style-3d"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div
              className={`absolute inset-0 backface-hidden ${isFlipped ? 'pointer-events-none' : ''}`}
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div
                className={`${cardShell} flex flex-col items-center justify-center p-12 relative cursor-pointer`}
                onClick={() => {
                  if (!hasStudyWords) {
                    setShowSettings(true);
                    return;
                  }
                  setIsFlipped(true);
                }}
              >
                <div className={neutralMist} />
                {!hasStudyWords ? (
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <p className="text-gray-900 text-2xl mb-3">学習する単語がありません</p>
                    <p className="text-base text-gray-600">
                      {selectedFolders.length === 0
                        ? 'フォルダを選択するか、単語を追加してから学習を始めましょう'
                        : '今日復習する単語はありません。おめでとうございます！'}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettings(true);
                      }}
                      className="mt-6 px-8 py-3 bg-white/80 backdrop-blur-xl text-[#1B7FA3] rounded-full hover:bg-white transition-colors border-none shadow-md ring-1 ring-black/5"
                    >
                      設定を開く
                    </button>
                  </div>
                ) : frontContent!.type === 'image' ? (
                  <img
                    src={frontContent!.content}
                    alt="flashcard"
                    className="max-w-full max-h-full object-contain rounded-3xl shadow-lg relative z-10"
                  />
                ) : (
                  <div className="relative z-10 flex flex-col items-center">
                    <h2 className="flashcard-front-text text-[#4a5565] break-words text-center font-['SF_Pro:Regular',sans-serif] mb-4">
                      {frontContent!.content}
                    </h2>
                    <p className="text-base text-gray-400 mt-6">タップして答えを表示</p>
                  </div>
                )}
              </div>
            </div>

            {/* Back */}
            <div
              className={`absolute inset-0 backface-hidden ${!isFlipped ? 'pointer-events-none' : ''}`}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className={`${cardShell} flex flex-col p-8 relative`}>
                <div className={neutralMist} />

                {/* ✅ ここを修正：min-h-0 + justify-start + top padding で上部の切れを防ぐ */}
                {!hasStudyWords ? (
                <div className="flex-1 min-h-0 flex items-center justify-center relative z-10 px-2">
                  <div className="text-center p-8">
                    <p className="text-gray-900 text-2xl mb-4">学習する単語がありません</p>
                    <p className="text-base text-gray-600">
                      {selectedFolders.length === 0
                        ? 'フォルダを選択するか、単語を追加してから学習を始めましょう'
                        : '今日復習する単語はありません。おめでとうございます！'}
                    </p>
                    <button
                      onClick={() => setShowSettings(true)}
                      className="mt-6 px-8 py-3 bg-white/80 backdrop-blur-xl text-[#1B7FA3] rounded-full hover:bg-white transition-colors border-none shadow-md ring-1 ring-black/5"
                    >
                      設定を開く
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto relative z-10 px-2">
                  <div className="flex flex-col items-center space-y-6 pt-6 pb-6">
                    <div className="text-center">
                      <p className="text-5xl md:text-6xl text-[#4a5565] font-['SF_Pro:Regular',sans-serif]">
                        {currentWord.word}
                      </p>
                    </div>

                    {currentWord.katakana && (
                      <div className="text-center">
                        <p className="text-2xl text-[rgba(74,85,101,0.7)]">{currentWord.katakana}</p>
                      </div>
                    )}

                    {currentWord.japaneseExplanation && (
                      <div className="text-center">
                        <p className="text-xl text-[rgba(74,85,101,0.8)]">
                          {currentWord.japaneseExplanation}
                        </p>
                      </div>
                    )}

                    {currentWord.chinese && (
                      <div className="text-center pt-4 border-t border-gray-200 w-full">
                        <p className="text-3xl text-[#4a5565]">{currentWord.chinese}</p>
                      </div>
                    )}

                    {currentWord.english && (
                      <div className="text-center">
                        <p className="text-2xl text-[#4a5565]">{currentWord.english}</p>
                        {currentWord.phonetic && (
                          <p className="text-base text-[rgba(106,114,130,0.6)] mt-1">
                            {currentWord.phonetic}
                          </p>
                        )}
                      </div>
                    )}

                    {currentWord.otherTranslations && currentWord.otherTranslations.length > 0 && (
                      <div className="text-center space-y-1">
                        {currentWord.otherTranslations.map((translation, index) => (
                          <p key={index} className="text-base text-[rgba(74,85,101,0.7)]">
                            {translation}
                          </p>
                        ))}
                      </div>
                    )}

                    {currentWord.imageUrl && (
                      <div className="flex justify-center mt-4">
                        <img
                          src={currentWord.imageUrl}
                          alt={currentWord.word}
                          className="w-48 h-48 object-cover rounded-2xl shadow-md"
                        />
                      </div>
                    )}
                  </div>
                </div>

                
              )}<div className={`flex gap-4 mt-6 relative z-10 ${!hasStudyWords ? "opacity-40 pointer-events-none" : ""}`}>
                  <button
                    onClick={() => handleNext('hard')}
                    className={`${tintButtonBase} bg-[#F7893F]/15 hover:bg-[#F7893F]/20 text-[#B85B1F]`}
                  >
                    難しい
                  </button>
                  <button
                    onClick={() => handleNext('good')}
                    className={`${tintButtonBase} bg-[#53BEE8]/16 hover:bg-[#53BEE8]/22 text-[#1B7FA3]`}
                  >
                    普通
                  </button>
                  <button
                    onClick={() => handleNext('easy')}
                    className={`${tintButtonBase} bg-[#2AC69E]/16 hover:bg-[#2AC69E]/22 text-[#147A61]`}
                  >
                    簡単
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 mb-4">
          <p className="text-gray-400 text-base">
            {isFlipped ? '評価を選択してください' : 'カードをタップして裏面を表示'}
          </p>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-xl">学習設定</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-base mb-3 text-gray-700">学習範囲を選択</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {folders.map((folder) => (
                    <label
                      key={folder.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFolders.includes(folder.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFolders([...selectedFolders, folder.id]);
                          } else {
                            setSelectedFolders(selectedFolders.filter((id) => id !== folder.id));
                          }
                        }}
                        className="w-5 h-5 text-[#53BEE8] rounded focus:ring-2 focus:ring-[#53BEE8] border-gray-300"
                      />
                      <span className="text-gray-700">{folder.name}</span>
                    </label>
                  ))}
                  <label className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedFolders.includes('no-folder')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFolders([...selectedFolders, 'no-folder']);
                        } else {
                          setSelectedFolders(selectedFolders.filter((id) => id !== 'no-folder'));
                        }
                      }}
                      className="w-5 h-5 text-[#53BEE8] rounded focus:ring-2 focus:ring-[#53BEE8] border-gray-300"
                    />
                    <span className="text-gray-500 italic">フォルダ未設定の単語</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-base mb-3 text-gray-700">カード正面の表示</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'japanese' as FrontDisplayType, label: '日本語', icon: '🇯🇵' },
                    { value: 'chinese' as FrontDisplayType, label: '中国語', icon: '🇨🇳' },
                    { value: 'english' as FrontDisplayType, label: '英語', icon: '🇬🇧' },
                    { value: 'image' as FrontDisplayType, label: '画像', icon: '🖼️' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFrontDisplayType(option.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        frontDisplayType === option.value
                          ? 'border-[#53BEE8] bg-[#53BEE8]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{option.icon}</div>
                      <div className="text-sm text-gray-700">{option.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-800">💡 学習システムについて</p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>「難しい」→ 翌日に復習</li>
                  <li>「普通」→ 3日後に復習</li>
                  <li>「簡単」→ 1週間後に復習</li>
                  <li>「簡単」または「普通」を2回連続 → 次のレベルへ</li>
                  <li>「簡単」レベルで2回連続「簡単」→ 学習完了</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3 bg-[#53BEE8] text-white rounded-lg hover:bg-[#53BEE8]/90 transition-colors border-none"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}