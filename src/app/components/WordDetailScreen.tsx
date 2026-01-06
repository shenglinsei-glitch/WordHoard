import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit3, Folder as FolderIcon, Volume2 } from 'lucide-react';
import { Word, Folder } from '../types';

interface Props {
  words: Word[];
  folders: Folder[];
}

type Difficulty = NonNullable<Word['studyState']>['difficulty'];

function difficultyUI(d: Difficulty) {
  switch (d) {
    case 'hard':
      return { label: '難しい', pill: 'bg-orange-100 text-orange-700' };
    case 'good':
      return { label: '普通', pill: 'bg-sky-100 text-sky-700' };
    case 'easy':
      return { label: '簡単', pill: 'bg-emerald-100 text-emerald-700' };
    case 'completed':
      return { label: '完了', pill: 'bg-gray-100 text-gray-700' };
    default:
      return { label: String(d), pill: 'bg-gray-100 text-gray-700' };
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function WordDetailScreen({ words, folders }: Props) {
  const { id } = useParams();
  const navigate = useNavigate();

  const word = useMemo(() => words.find((w) => w.id === id), [words, id]);
  if (!word) return null;


  const handleSpeak = (text: string, lang: string) => {
    if (!text) return;
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('お使いのブラウザは音声再生に対応していません');
    }
  };


  const folderNames = useMemo(() => {
    if (!word.folders?.length) return [];
    return folders.filter((f) => word.folders!.includes(f.id));
  }, [word.folders, folders]);

  const diff = word.studyState?.difficulty;
  const diffUI = diff ? difficultyUI(diff) : null;

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20 overflow-x-hidden flex flex-col">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 flex-1">
        {/* Floating header buttons (same direction as Home/Flashcard) */}
        <div className="relative flex items-center justify-between mt-6 mb-6">
          <button
            onClick={() => navigate('/list')}
            className="h-12 w-12 flex items-center justify-center bg-white/80 backdrop-blur-xl rounded-full shadow-md ring-1 ring-black/5 hover:bg-white transition-colors"
            aria-label="戻る"
          >
            <ArrowLeft size={20} className="text-[#53BEE8]" />
          </button>

          <button
            onClick={() => navigate(`/edit/${word.id}`)}
            className="h-12 w-12 flex items-center justify-center bg-white/80 backdrop-blur-xl rounded-full shadow-md ring-1 ring-black/5 hover:bg-white transition-colors"
            aria-label="編集"
          >
            <Edit3 size={20} className="text-[#53BEE8]" />
          </button>
        </div>

        {/* Main text card */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-center">
            <h1 className="text-4xl font-semibold text-gray-800">{word.word}</h1>
            {word.katakana && (
              <div className="mt-2 flex items-center justify-center gap-2 text-gray-400">
                <span>{word.katakana}</span>
                <button
                  type="button"
                  onClick={() => handleSpeak(word.word, 'ja-JP')}
                  className="p-1 rounded-md hover:bg-black/5 transition-colors"
                  aria-label="日本語を再生"
                  title="再生"
                >
                  <Volume2 size={18} className="text-[#53BEE8]" />
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            {word.chinese && <div className="text-lg text-center text-gray-800">{word.chinese}</div>}

            {(word.english || word.phonetic) && (
              <div className="text-center">
                {word.english && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-[18px] text-gray-700">{word.english}</div>
                    
                  </div>
                )}
                {word.phonetic && (
                  <div className="mt-1 flex items-center justify-center gap-2 text-[14px] text-gray-400">
                    <span>{word.phonetic}</span>
                    <button
                      type="button"
                      onClick={() => handleSpeak(word.english ?? word.word, 'en-US')}
                      className="p-1 rounded-md hover:bg-black/5 transition-colors"
                      aria-label="英語を再生"
                      title="再生"
                    >
                      <Volume2 size={18} className="text-[#53BEE8]" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {word.japaneseExplanation && (
              <div className="pt-2 text-center text-gray-600 whitespace-pre-wrap">{word.japaneseExplanation}</div>
            )}

            {word.otherTranslations?.length ? (
              <div className="pt-2 text-center text-gray-600 whitespace-pre-wrap">
                {word.otherTranslations.filter(Boolean).join('\n')}
              </div>
            ) : null}
          </div>
        </div>

        {/* Image card: separate area */}
        {word.imageUrl && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-4">
            <img
              src={word.imageUrl}
              alt=""
              className="w-full max-h-[420px] object-contain rounded-xl bg-gray-50"
            />
          </div>
        )}

        {/* Folders */}
        {folderNames.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <FolderIcon size={18} className="text-[#53BEE8]" />
              <span className="text-sm">所属フォルダ</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {folderNames.map((f) => (
                <span key={f.id} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                  {f.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Study status */}
        {word.studyState && (
          <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
            <div className="text-sm text-gray-500 mb-3">学習状態</div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">現在のレベル</span>
              {diffUI ? (
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${diffUI.pill}`}>
                  {diffUI.label}
                </span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )}
            </div>

            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">次回復習</span>
              <span className="text-sm text-gray-700">{formatDate(word.studyState.nextReviewDate)}</span>
            </div>
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}