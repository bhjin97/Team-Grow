'use client';

import * as React from 'react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  User,
  Bot,
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
import { chatStream } from '@/lib/api';  // ⬅️ 추가: 스트리밍 래퍼 사용

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
}

export default function ChatInterface({ userName = 'Sarah', onNavigate }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'ai',
      content:
        "Hello! I'm your beauty AI assistant. You can upload product images to analyze ingredients, or ask me for personalized product recommendations. How can I help you today?",
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

  const name = useUserStore(state => state.name);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  React.useEffect(() => { scrollToBottom(); }, [messages]);

  // ⬇️ ⬇️ ⬇️ 여기부터 핵심 변경: 스트리밍 연결
  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text) return;

    // 1) 사용자 메시지 추가
    const userMsg: Message = {
      id: messages.length + 1,
      type: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // 2) AI placeholder 추가 (빈 컨텐츠로 시작)
    const aiMsgId = userMsg.id + 1;
    const aiMsg: Message = {
      id: aiMsgId,
      type: 'ai',
      content: '',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(true);

    // 3) 스트리밍 호출
    try {
      const { iter } = await chatStream(text, 6);
      for await (const chunk of iter()) {
        // 토큰 도착마다 마지막 AI메시지에 이어붙이기
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: (m.content || '') + chunk } : m
        ));
      }
    } catch (err) {
      // 에러 시 안내 문구
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: '죄송해요. 잠시 후 다시 시도해주세요.' }
          : m
      ));
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };
  // ⬆️ ⬆️ ⬆️ 핵심 변경 끝

  // 기존 Mock 분석(이미지) 로직은 유지 (백엔드 멀티모달 연결 전 데모용)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageMessage: Message = {
        id: messages.length + 1,
        type: 'user',
        content: 'Please analyze this product',
        image: reader.result as string,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, imageMessage]);
      setIsTyping(true);
      setTimeout(() => {
        const analysisResponse: Message = {
          id: messages.length + 2,
          type: 'ai',
          content: "I've analyzed the product image. Here's what I found:",
          timestamp: new Date(),
          productInfo: {
            name: 'Hydrating Facial Serum',
            ingredients: [
              'Hyaluronic Acid - Excellent hydration',
              'Niacinamide - Brightening & pore refining',
              'Vitamin E - Antioxidant protection',
              'Glycerin - Moisture retention',
              'Panthenol - Soothing & healing',
            ],
            description:
              'This is a great product for combination skin! The hyaluronic acid will hydrate dry areas, while niacinamide helps control oil in the T-zone. All ingredients are safe for your skin type and there are no concerning ingredients based on your profile.',
          },
        };
        setMessages(prev => [...prev, analysisResponse]);
        setIsTyping(false);
      }, 2000);
    };
    reader.readAsDataURL(file);
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
              <h1 className="text-5xl sm:text-6xl font-light tracking-wide" style={{ fontFamily: "'Italianno', cursive", color: '#9b87f5' }}>
                aller
              </h1>
            </div>
            <nav className="hidden md:flex items-center space-x-1">
              <button onClick={() => onNavigate?.('dashboard')} className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors">
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button onClick={() => onNavigate?.('chat')} className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors relative" style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)', color: 'white' }}>
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
                {savedProducts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {savedProducts.length}
                  </span>
                )}
              </button>
              <button onClick={() => onNavigate?.('profile')} className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors">
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button onClick={() => onNavigate?.('settings')} className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors">
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </nav>
            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-pink-600 transition-colors relative">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button onClick={() => onNavigate?.('profile')} className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}>
                {name.charAt(0).toUpperCase()}
              </button>
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-gray-700 hover:text-pink-600 transition-colors">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden mt-4 pb-4 space-y-3">
              <button onClick={() => { onNavigate?.('dashboard'); setMobileMenuOpen(false); }} className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50">
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button onClick={() => { onNavigate?.('chat'); setMobileMenuOpen(false); }} style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }} className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-white font-semibold relative">
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
                {savedProducts.length > 0 && (
                  <span className="absolute top-2 right-4 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {savedProducts.length}
                  </span>
                )}
              </button>
              <button onClick={() => { onNavigate?.('profile'); setMobileMenuOpen(false); }} className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50">
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button onClick={() => { onNavigate?.('settings'); setMobileMenuOpen(false); }} className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50">
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-4xl flex-1 flex flex-col min-h-0">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col flex-1 min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3 sm:space-y-4">
              <AnimatePresence>
                {messages.map(message => (
                  <motion.div key={message.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-2 sm:space-x-3 max-w-[85%] sm:max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0"
                           style={{ background: message.type === 'user' ? 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' : 'linear-gradient(135deg, #dac4e8 0%, #c4d4f0 100%)' }}>
                        {message.type === 'user' ? <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" /> : <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                      </div>

                      <div className={`rounded-2xl p-3 sm:p-4 ${message.type === 'user' ? 'text-white' : 'bg-gray-100 text-gray-800'}`}
                           style={ message.type === 'user' ? { background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' } : {} }>
                        {message.image && (
                          <img src={message.image} alt="Uploaded product" className="rounded-lg mb-2 sm:mb-3 max-w-full w-full sm:max-w-xs" />
                        )}
                        <p className="text-sm sm:text-base whitespace-pre-line break-words">{message.content}</p>

                        {message.productInfo && (
                          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white rounded-lg">
                            <h4 className="text-sm sm:text-base font-bold text-pink-600 mb-2 flex items-center">
                              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                              <span className="break-words">{message.productInfo.name}</span>
                            </h4>
                            <div className="mb-2 sm:mb-3">
                              <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2">Key Ingredients:</p>
                              <ul className="space-y-1">
                                {message.productInfo.ingredients.map((ingredient, idx) => (
                                  <li key={idx} className="text-xs sm:text-sm text-gray-600 flex items-start">
                                    <span className="text-green-500 mr-2 flex-shrink-0">✓</span>
                                    <span className="break-words">{ingredient}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="pt-2 sm:pt-3 border-t border-gray-200 mb-3">
                              <p className="text-xs sm:text-sm text-gray-600 break-words">{message.productInfo.description}</p>
                            </div>
                            <button onClick={() => handleSaveProduct(message.id)}
                                    className={`w-full py-2 px-3 rounded-lg flex items-center justify-center space-x-2 transition-all ${savedProducts.includes(message.id) ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'}`}>
                              {savedProducts.includes(message.id) ? (<><BookmarkCheck className="w-4 h-4" /><span className="text-xs sm:text-sm font-medium">저장됨</span></>) : (<><Bookmark className="w-4 h-4" /><span className="text-xs sm:text-sm font-medium">제품 저장하기</span></>)}
                            </button>
                          </div>
                        )}

                        <p className="text-xs mt-2 opacity-70">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start space-x-2 sm:space-x-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-400 flex items-center justify-center">
                    <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl p-3 sm:p-4">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 sm:p-4 bg-white flex-shrink-0">
              <div className="flex items-end space-x-2 sm:space-x-3">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="p-2 sm:p-3 rounded-xl bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors flex-shrink-0" title="Upload product image">
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
          <button onClick={() => onNavigate?.('dashboard')} className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors">
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs">대시보드</span>
          </button>
          <button onClick={() => onNavigate?.('chat')} className="flex flex-col items-center space-y-1 text-pink-600 relative">
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs font-semibold">AI 상담</span>
            {savedProducts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {savedProducts.length}
              </span>
            )}
          </button>
          <button onClick={() => onNavigate?.('profile')} className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors">
            <UserCircle className="w-6 h-6" />
            <span className="text-xs">프로필</span>
          </button>
          <button onClick={() => onNavigate?.('settings')} className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors">
            <SettingsIcon className="w-6 h-6" />
            <span className="text-xs">설정</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
