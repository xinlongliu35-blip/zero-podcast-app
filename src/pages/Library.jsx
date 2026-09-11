import React, { useState, useMemo } from 'react';
import { Settings, Search, Plus, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';
import { mockNotes } from '../data/mockData';

const Library = () => {
  const navigate = useNavigate();
  const { folders, notes } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Combine notes for count calculation
  const allNotes = useMemo(() => [...notes, ...mockNotes], [notes]);

  const filteredFolders = useMemo(() => {
    return folders
      .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(folder => ({
        ...folder,
        dynamicCount: allNotes.filter(n => n.folder === folder.name || n.topic === folder.name).length
      }));
  }, [folders, searchQuery, allNotes]);

  return (
    <div className="flex flex-col min-h-full bg-background px-4 pb-[100px]">
      {/* Top Header */}
      <div className="h-[52px] flex items-center justify-between">
        <h1 className="text-[20px] font-bold text-text-main">zero</h1>
        <button 
          onClick={() => navigate('/settings')}
          className="text-text-gray active:scale-90 transition-transform"
        >
          <Settings size={22} />
        </button>
      </div>

      <div className="mt-2 mb-5">
        <h2 className="text-[24px] font-bold text-text-main">库藏</h2>
        <p className="text-[12px] text-text-gray mt-1 font-medium">
          AI整理后的内容，按主题沉淀
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
            placeholder="搜索库藏..."
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

      {/* Folder Grid */}
      <div className="grid grid-cols-2 gap-[12px]">
        {filteredFolders.map(folder => (
          <div 
            key={folder.id}
            onClick={() => navigate('/library/' + folder.id)}
            className="bg-white rounded-[14px] p-4 h-[110px] shadow-card border border-border-color/50 flex flex-col relative active:scale-[0.96] transition-all cursor-pointer group hover:border-primary/20"
          >
            <div className="flex justify-between items-start">
              <div 
                className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                style={{ backgroundColor: folder.icon === '文' ? '#1A1A1A' : folder.icon === 'B' ? '#FB7299' : '#FF2442' }}
              >
                {folder.icon}
              </div>
              <div className="w-[18px] h-[18px] bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {folder.dynamicCount}
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-[15px] font-bold text-text-main">
                {folder.name}
              </div>
              <div className="text-[10px] text-text-gray font-medium mt-0.5 opacity-60">
                {folder.update}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Library;