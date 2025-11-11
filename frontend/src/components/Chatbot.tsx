'use client';

import * as React from 'react';
import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  User,
  Camera,
  Sparkles,
  Menu,
  X,
  LayoutDashboard,
  Settings as SettingsIcon,
  MessageSquare,
  UserCircle,
  Bookmark,
  BookmarkCheck,
  Bell,
} from 'lucide-react';
import { useUserStore } from '@/stores/auth/store';
import { chatStream, fetchRecommendations, RecProduct, uploadOcrImage } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SS_KEY,
  MAX_KEEP,
  PersistMsg,
  MessageLike,
  loadSession,
  toPersist,
  createSessionSaver,
} from '@/lib/chatSession';

export interface ChatInterfaceProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

interface Message {
  id: number;
  type: 'user' | 'ai';
  content: string;
  image?: string;
  timestamp: Date;
  productInfo?: {
    name: string;
    ingredients: string[];
    description: string;
  };
  products?: RecProduct[];
  analysis?: any;
  ocrImageUrl?: string | null;
}

export default function Chatbot({ userName = 'Sarah', onNavigate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'ai',
      content:
        '안녕하세요! 저는 여러분의 뷰티 AI 어시스턴트입니다. 제품 이미지를 업로드하여 성분을 분석하거나, 맞춤형 제품 추천을 요청하실 수 있습니다. 오늘 무엇을 도와드릴까요?',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedProducts, setSavedProducts] = useState<number[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openPanelByCard, setOpenPanelByCard] = useState<Record<string, 'review' | 'ings' | null>>(
    {}
  );
  const name = useUserStore(state => state.name);
  const nextIdRef = useRef<number>(2);

  // ── 세션 복원
  useEffect(() => {
    try {
      const restored = loadSession(SS_KEY);
      if (restored.length) {
        setMessages(restored as Message[]);
        const maxId = restored.reduce((m, x) => Math.max(m, x.id), 0);
        nextIdRef.current = Math.max(maxId + 1, 2);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 스크롤 하단 고정
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ── 세션 저장(디바운스 + 안전저장)
  const scheduleSave = useMemo(() => createSessionSaver(SS_KEY, 200), []);
  useEffect(() => {
    try {
      const recent = messages.slice(-MAX_KEEP);
      const payload: PersistMsg[] = toPersist(recent as MessageLike[]);
      scheduleSave(payload);
    } catch {}
  }, [messages, scheduleSave]);

  // ── 전송 핸들러 (스트리밍 + 추천카드)
  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text) return;

    const userMsg: Message = {
      id: nextIdRef.current++,
      type: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    const aiMsgId = nextIdRef.current++;
    const aiMsg: Message = { id: aiMsgId, type: 'ai', content: '', timestamp: new Date() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(true);

    try {
      const { iter, cacheKey } = await chatStream(text, 6);
      for await (const chunk of iter()) {
        setMessages(prev =>
          prev.map(m => (m.id === aiMsgId ? { ...m, content: (m.content || '') + chunk } : m))
        );
      }
      const { products } = await fetchRecommendations(text, 12, cacheKey);
      setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, products } : m)));
      setOpenPanelByCard({});
    } catch (err) {
      setMessages(prev =>
        prev.map(m => (m.id === aiMsgId ? { ...m, content: '잠시 후 다시 시도해주세요.' } : m))
      );
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  // ── 이미지 업로드 → OCR
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localPreview = URL.createObjectURL(file);
    const userMsg: Message = {
      id: nextIdRef.current++,
      type: 'user',
      content: '이 제품 이미지 분석해줘',
      image: localPreview,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const aiMsgId = nextIdRef.current++;
    const aiMsg: Message = {
      id: aiMsgId,
      type: 'ai',
      content: '분석 중입니다…',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(true);

    try {
      const { analysis, render } = await uploadOcrImage(file);
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? {
                ...m,
                content: render?.text || '분석 결과를 표시할 수 없습니다.',
                image: render?.image_url || undefined,
                analysis,
                ocrImageUrl: render?.image_url ?? null,
              }
            : m
        )
      );
    } catch (err) {
      console.error(err);
      setMessages(prev =>
        prev.map(m =>
          m.id === aiMsgId
            ? { ...m, content: '❌ OCR 분석에 실패했습니다. 잠시 후 다시 시도해주세요.' }
            : m
        )
      );
    } finally {
      setIsTyping(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveProduct = (messageId: number) => {
    if (savedProducts.includes(messageId)) {
      setSavedProducts(savedProducts.filter(id => id !== messageId));
      setToastMessage('제품 저장이 취소되었습니다');
    } else {
      setSavedProducts([...savedProducts, messageId]);
      setToastMessage('제품이 저장되었습니다! ✓');
    }
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
    >
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-white shadow-lg rounded-lg px-6 py-3 border-l-4 border-pink-500"
          >
            <p className="text-sm font-medium text-gray-800">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-3.5 sm:px--0.5 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1
                className="text-5xl sm:text-6xl font-light tracking-wide"
                style={{ fontFamily: "'Italianno', cursive", color: '#9b87f5' }}
              >
                aller
              </h1>
            </div>
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => onNavigate?.('dashboard')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button
                onClick={() => onNavigate?.('chat')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors relative"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                  color: 'white',
                }}
              >
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
                {savedProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {savedProducts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button
                onClick={() => onNavigate?.('settings')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </nav>
            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-pink-600 transition-colors relative">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
              >
                {name.charAt(0).toUpperCase()}
              </button>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-pink-600 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden mt-4 pb-4 space-y-3"
            >
              <button
                onClick={() => {
                  onNavigate?.('dashboard');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('chat');
                  setMobileMenuOpen(false);
                }}
                style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-white font-semibold relative"
              >
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
                {savedProducts.length > 0 && (
                  <span className="absolute top-2 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {savedProducts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  onNavigate?.('profile');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('settings');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-y-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {/* Chat */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-4xl flex-1 flex flex-col min-h-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
              <AnimatePresence>
                {messages.map(message => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start ${
                        message.type === 'user'
                          ? 'flex-row-reverse space-x-reverse gap-3 sm:gap-4'
                          : 'space-x-2 sm:space-x-3'
                      } max-w-[85%] sm:max-w-[80%]`}
                    >
                      {message.type === 'ai' ? (
                        <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0">
                          <img
                            src="/ai-droplet.png"
                            alt="AI"
                            className="w-full h-full object-contain"
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.15))' }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                          }}
                        >
                          <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                      )}

                      <div
                        className={`rounded-2xl p-3 sm:p-4 ${
                          message.type === 'user' ? 'text-white' : 'bg-gray-100 text-gray-800'
                        }`}
                        style={
                          message.type === 'user'
                            ? { background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }
                            : {}
                        }
                      >
                        {message.image && message.type === 'user' && (
                          <img
                            src={message.image}
                            alt="Uploaded product"
                            className="rounded-lg mb-2 sm:mb-3 max-w-full w-full sm:max-w-xs"
                          />
                        )}

                        {message.type === 'ai' ? (
                          <div className="prose prose-sm max-w-none leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content || ''}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm sm:text-base whitespace-pre-line break-words">
                            {message.content}
                          </p>
                        )}

                        {message.products && message.products.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <h4 className="text-sm sm:text-base font-semibold text-pink-600">
                              추천 제품
                            </h4>

                            {message.products.slice(0, 6).map((p, i) => {
                              const cardKey = String(
                                `${message.id}-` +
                                  (p.pid ?? `${p.brand ?? ''}-${p.product_name ?? ''}-${i}`)
                              );
                              const open = openPanelByCard[cardKey] ?? null;
                              const toggle = (which: 'review' | 'ings') =>
                                setOpenPanelByCard(prev => ({
                                  ...prev,
                                  [cardKey]: prev[cardKey] === which ? null : which,
                                }));

                              return (
                                <div
                                  key={cardKey}
                                  className="p-3 sm:p-4 bg-white rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-start gap-3">
                                    {p.image_url && (
                                      <img
                                        src={p.image_url}
                                        alt={p.product_name || ''}
                                        className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                                      />
                                    )}

                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm sm:text-base font-bold text-gray-800 truncate">
                                        {(p.brand ? `${p.brand} · ` : '') + (p.product_name || '')}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {p.category || ''}
                                      </div>

                                      {p.price_krw != null && (
                                        <div className="mt-1 text-sm text-gray-700">
                                          ₩{p.price_krw.toLocaleString()}
                                        </div>
                                      )}

                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {!!p.rag_text && (
                                          <button
                                            type="button"
                                            onClick={() => toggle('review')}
                                            aria-expanded={open === 'review'}
                                            className={`text-xs px-2 py-1 rounded-lg border transition ${
                                              open === 'review'
                                                ? 'bg-pink-50 text-pink-700 border-pink-200'
                                                : 'bg-white text-pink-600 border-pink-200 hover:bg-pink-50'
                                            }`}
                                          >
                                            리뷰 요약 보기
                                          </button>
                                        )}

                                        {Array.isArray(p.ingredients) &&
                                          p.ingredients.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => toggle('ings')}
                                              aria-expanded={open === 'ings'}
                                              className={`text-xs px-2 py-1 rounded-lg border transition ${
                                                open === 'ings'
                                                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                                                  : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50'
                                              }`}
                                            >
                                              성분 보기
                                            </button>
                                          )}

                                        {p.product_url && (
                                          <a
                                            href={p.product_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs text-white px-3 py-1 rounded-lg"
                                            style={{
                                              background:
                                                'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                                            }}
                                          >
                                            상품 페이지
                                          </a>
                                        )}
                                      </div>

                                      {open === 'review' && !!p.rag_text && (
                                        <div className="mt-2 text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-2">
                                          {p.rag_text}
                                        </div>
                                      )}

                                      {open === 'ings' &&
                                        Array.isArray(p.ingredients) &&
                                        p.ingredients.length > 0 && (
                                          <div className="mt-2">
                                            <div className="flex flex-wrap gap-1.5">
                                              {p.ingredients.slice(0, 60).map((ing, idx) => (
                                                <span
                                                  key={`${cardKey}-${idx}`}
                                                  className="inline-block text-[11px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700"
                                                  title={ing}
                                                >
                                                  {ing}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                    </div>

                                    {typeof p.score === 'number' && (
                                      <div className="text-[11px] text-gray-500 ml-2">
                                        sim {p.score.toFixed(3)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {message.productInfo && (
                          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white rounded-lg">
                            <h4 className="text-sm sm:text-base font-bold text-pink-600 mb-2 flex items-center">
                              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                              <span className="break-words">{message.productInfo.name}</span>
                            </h4>
                            <div className="mb-2 sm:mb-3">
                              <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                                Key Ingredients:
                              </p>
                              <ul className="space-y-1">
                                {message.productInfo.ingredients.map((ingredient, idx) => (
                                  <li
                                    key={idx}
                                    className="text-xs sm:text-sm text-gray-600 flex items-start"
                                  >
                                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                                    <span className="break-words">{ingredient}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="pt-2 sm:pt-3 border-t border-gray-200 mb-3">
                              <p className="text-xs sm:text-sm text-gray-600 break-words">
                                {message.productInfo.description}
                              </p>
                            </div>
                            <button
                              onClick={() => handleSaveProduct(message.id)}
                              className={`w-full py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all ${
                                savedProducts.includes(message.id)
                                  ? 'bg-pink-500 text-white'
                                  : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                              }`}
                            >
                              {savedProducts.includes(message.id) ? (
                                <>
                                  <BookmarkCheck className="w-4 h-4" />
                                  <span className="text-xs sm:text-sm font-medium">저장됨</span>
                                </>
                              ) : (
                                <>
                                  <Bookmark className="w-4 h-4" />
                                  <span className="text-xs sm:text-sm font-medium">
                                    제품 저장하기
                                  </span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        <p className="text-xs mt-2 opacity-70">
                          {message.timestamp.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start space-x-2 sm:space-x-3"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0">
                    <img src="/ai-droplet.png" alt="AI" className="w-full h-full object-contain" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl p-3 sm:p-4">
                    <div className="flex space-x-2">
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 sm:p-4 bg-white flex-shrink-0">
              <div className="flex items-end space-x-2 sm:space-x-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 sm:p-3 rounded-xl bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors flex-shrink-0"
                  title="Upload product image"
                >
                  <Camera className="w-5 h-5 sm:w-5 sm:h-5" />
                </button>
                <div className="flex-1 flex items-end space-x-2">
                  <textarea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="제품에 대해 물어보세요..."
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-200 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent resize-none max-h-24"
                    rows={1}
                  />
                  <motion.button
                    onClick={handleSendMessage}
                    disabled={inputValue.trim() === ''}
                    className="p-2 sm:p-3 rounded-xl text-white hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Send className="w-5 h-5 sm:w-5 sm:h-5" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs">대시보드</span>
          </button>
          <button
            onClick={() => onNavigate?.('chat')}
            className="flex flex-col items-center space-y-1 text-pink-600 relative"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs font-semibold">AI 상담</span>
            {savedProducts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {savedProducts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => onNavigate?.('profile')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <UserCircle className="w-6 h-6" />
            <span className="text-xs">프로필</span>
          </button>
          <button
            onClick={() => onNavigate?.('settings')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <SettingsIcon className="w-6 h-6" />
            <span className="text-xs">설정</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
