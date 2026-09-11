import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Settings, Search, Mic, MoreHorizontal, Plus, Home as HomeIcon, Folder, ArrowLeft } from 'lucide-react';
import { useStore } from '../data/store';
import { mockNotes, mockFolders } from '../data/mockData';

const Home = ({ isFolderView = false }) => {
  const navigate = useNavigate();
  const { folderId } = useParams();
  const { notes, setInputModalOpen, learningStreak } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Get current folder info if in folder view
  const currentFolder = useMemo(() => {
    if (!isFolderView || !folderId) return null;
    return mockFolders.find(f => f.id.toString() === folderId);
  }, [isFolderView, folderId]);

  // Merge store notes with mock data if needed, and sort by createdAt
  const allNotes = useMemo(() => {
    const combined = [...notes, ...mockNotes];
    let result = combined.sort((a, b) => b.createdAt - a.createdAt);
    
    if (isFolderView && currentFolder) {
      result = result.filter(n => n.folder === currentFolder.name || n.topic === currentFolder.name);
    }
    
    return result;
  }, [notes, isFolderView, currentFolder]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery) return allNotes;
    return allNotes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [allNotes, searchQuery]);

  const getPlatformStyle = (platform) => {
    switch (platform) {
      case 'douyin': return { bg: 'from-gray-800 to-black', text: 'D' };
      case 'bilibili': return { bg: 'from-pink-400 to-pink-500', text: 'B' };
      case 'xiaohongshu': return { bg: 'from-red-500 to-red-600', text: '书' };
      case 'wechat': return { bg: 'from-green-500 to-green-600', text: '文' };
      default: return { bg: 'from-gray-400 to-gray-500', text: 'Z' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Top Nav */}
      <div className="h-[52px] px-4 flex items-center justify-between z-30">
        {isFolderView ? (
          <button 
            onClick={() => navigate('/library')}
            className="flex items-center gap-1 text-text-main font-bold active:scale-95 transition-transform"
          >
            <ArrowLeft size={20} />
            <span className="text-[15px]">返回库藏</span>
          </button>
        ) : (
          <div className="relative">
            {/* Rose Petal Decoration for Brand Name - Minimalist B&W */}
            <div id="brand-logo-rose" className="absolute -top-1 -left-2 -right-4 -bottom-1 opacity-20 pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
                <path d="M10,20 C15,5 25,5 30,15 C35,5 45,5 50,15 C50,25 40,35 30,38 C20,35 10,25 10,20 Z" fill="black" opacity="0.6" transform="rotate(-15 30 20) scale(0.6)" />
                <path d="M60,10 C65,2 75,2 80,8 C85,2 95,2 100,8 C100,15 90,22 80,25 C70,22 60,15 60,10 Z" fill="white" stroke="black" strokeWidth="2" opacity="0.4" transform="rotate(20 80 10) scale(0.4)" />
              </svg>
            </div>
            <h1 className="relative text-[22px] font-black text-black tracking-[-0.05em] lowercase">zero</h1>
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {/* Streak Counter - Minimalist B&W Rose Style */}
          {!isFolderView && (
            <div className="relative group px-3 py-1.5 bg-white rounded-full border border-black/10 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
              {/* Minimalist Black & White Rose Petals */}
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <svg width="100%" height="100%" viewBox="0 0 100 100">
                  <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="black" transform="scale(0.25) translate(20, 20)" />
                  <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="none" stroke="black" strokeWidth="2" transform="scale(0.2) translate(350, 250) rotate(45)" />
                </svg>
              </div>
              
              <div className="relative flex items-center gap-2">
                <span className="text-[9px] font-black text-black/30 tracking-[0.2em] uppercase italic">Streak</span>
                <span className="text-[14px] font-black text-black tracking-tighter tabular-nums">{learningStreak}</span>
                <span className="text-[9px] font-black text-black/40 tracking-widest uppercase">Days</span>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => navigate('/settings')}
            className="text-text-gray active:scale-90 transition-transform p-1"
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-2 pb-[100px]">
        {/* Welcome/Stats */}
        <div className="mb-5">
          <h2 className="text-[24px] font-bold text-text-main">
            {isFolderView ? currentFolder?.name : '我的播客'}
          </h2>
          <p className="text-[13px] text-text-gray mt-1 font-medium">
            共 {allNotes.length} 条笔记 {!isFolderView && '· 4 个主题'}
          </p>
        </div>

        {/* Search Box */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-[44px] bg-secondary-bg rounded-xl flex items-center px-4 gap-3">
            <Search size={18} className="text-text-gray opacity-40" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearching(true)}
              placeholder="搜索播客..."
              className="flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-text-gray/30 text-text-main"
            />
          </div>
          {isSearching && (
            <button 
              onClick={() => {
                setIsSearching(false);
                setSearchQuery('');
              }}
              className="text-[14px] font-semibold text-text-main"
            >
              取消
            </button>
          )}
        </div>

        {/* Podcast List */}
        <div className="space-y-3">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => {
              const style = getPlatformStyle(note.platform);
              return (
                <div 
                  key={note.id}
                  onClick={() => navigate('/note/' + note.id)}
                  className="bg-white rounded-card p-[14px] flex items-center shadow-card border border-border-color/50 active:bg-secondary-bg transition-colors cursor-pointer group"
                >
                  {/* Cover */}
                  <div className={`w-[48px] h-[48px] rounded-xl bg-gradient-to-br ${style.bg} flex items-center justify-center shrink-0 shadow-sm`}>
                    <span className="text-white font-bold text-[16px]">{style.text}</span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0 ml-3">
                    <h3 className="text-[14px] font-bold text-text-main truncate">{note.title}</h3>
                    <div className="text-[11px] text-text-gray mt-1 font-medium flex items-center gap-2">
                      <span>{note.source}</span>
                      <span className="opacity-30">•</span>
                      <span>{note.duration || '00:00'}</span>
                    </div>
                  </div>

                  {/* Tag */}
                  <div className="ml-2 px-2 py-0.5 bg-secondary-bg rounded-[4px] text-[10px] font-bold text-text-gray shrink-0">
                    {note.topic || note.folder}
                  </div>
                </div>
              );
            })
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
              <Mic size={40} className="text-text-main" />
              <p className="text-[14px] text-text-main mt-4 font-bold">暂无播客内容</p>
              <p className="text-[12px] text-text-gray mt-1">点击下方按钮开始分析</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
