import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bookmark, Share2, Edit3, Clock, MoreHorizontal, Trash2, RefreshCw, Download, X, Check, Loader2, Copy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { mockNotes } from '../data/mockData';
import VinylPlayer from '../components/VinylPlayer';

const PROMPT_MODE_LABELS = {
  default: '真实还原',
  critical: '批判性思维',
  deep: '深度分析',
  custom: '自定义',
};

const NoteDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const notes = useStore((state) => state.notes);
  const deleteNote = useStore((state) => state.deleteNote);
  const updateNote = useStore((state) => state.updateNote);

  const note = notes.find(n => n.id.toString() === id) || mockNotes.find(n => n.id.toString() === id) || mockNotes[0];

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState(null);
  const [activePointId, setActivePointId] = useState(1);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [viewMode, setViewMode] = useState('points');
  const [isMoreModalOpen, setIsMoreModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (note) {
      setEditTitle(note.title || '');
      setEditContent(note.fullContent || (note.points?.map(p => `${p.time} ${p.title}\n${p.content}`).join('\n\n')) || '');
    }
  }, [note?.id]);

  useEffect(() => {
    if (!note.points || note.points.length === 0) return;
    const timeToSeconds = (timeStr) => {
      const [m, s] = timeStr.split(':').map(Number);
      return m * 60 + s;
    };
    const currentPoint = [...note.points].reverse().find(p => timeToSeconds(p.time) <= currentTime);
    if (currentPoint) setActivePointId(currentPoint.id);
  }, [currentTime, note.points]);

  const handlePointClick = (timeStr) => {
    const [m, s] = timeStr.split(':').map(Number);
    setSeekToTime(m * 60 + s);
    setTimeout(() => setSeekToTime(null), 100);
    setIsPlaying(true);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('链接已复制到剪贴板');
  };

  const handleDelete = () => {
    deleteNote(note.id);
    navigate('/');
  };

  const handleReanalyze = async () => {
    if (!note.url) {
      alert('这条笔记没有原始链接，无法重新分析');
      return;
    }
    setIsReanalyzing(true);
    setIsMoreModalOpen(false);
    try {
      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: note.url, mode: 'concise', promptMode: note.promptMode || 'default' })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      updateNote(note.id, { ...data, updatedAt: Date.now() });
      setEditTitle(data.title || '');
      setEditContent(data.fullContent || '');
      alert('重新分析完成');
    } catch (err) {
      alert(`重新分析失败：${err.message}`);
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleExport = () => {
    const content = `# ${note.title}\n\n来源：${note.source || ''}\n时长：${note.duration || ''}\n日期：${new Date(note.createdAt || Date.now()).toLocaleString()}\n风格：${PROMPT_MODE_LABELS[note.promptMode] || '真实还原'}\n\n---\n\n## 摘要\n${note.summary || ''}\n\n## 完整文稿\n${note.fullContent || note.points?.map(p => `[${p.time}] ${p.title}\n${p.content}`).join('\n\n') || ''}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `播客_${(note.title || 'untitled').slice(0, 30)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setIsMoreModalOpen(false);
  };

  const handleSaveEdit = () => {
    updateNote(note.id, { title: editTitle, fullContent: editContent });
    setIsEditing(false);
  };

  const handleCopyContent = () => {
    const text = note.fullContent || note.points?.map(p => `[${p.time}] ${p.title}\n${p.content}`).join('\n\n') || '';
    navigator.clipboard.writeText(text);
    alert('文稿已复制到剪贴板');
  };

  const getPlatformStyle = (platform) => {
    switch (platform) {
      case 'douyin': return { bg: 'from-gray-800 to-black', text: 'D' };
      case 'bilibili': return { bg: 'from-pink-400 to-pink-500', text: 'B' };
      case 'xiaohongshu': return { bg: 'from-red-500 to-red-600', text: '书' };
      case 'wechat': return { bg: 'from-green-500 to-green-600', text: '文' };
      case 'text': return { bg: 'from-blue-500 to-indigo-600', text: '本' };
      default: return { bg: 'from-gray-400 to-gray-500', text: 'Z' };
    }
  };

  const style = getPlatformStyle(note.platform);

  const MoreOptionsModal = () => (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMoreModalOpen(false)} />
      <div className="relative w-full max-w-[390px] bg-white rounded-t-[24px] p-6 pb-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl">
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
        <h2 className="text-[18px] font-bold text-text-main mb-6 px-2">更多功能</h2>

        <div className="space-y-3">
          <button onClick={handleReanalyze} disabled={isReanalyzing} className="w-full h-14 bg-secondary-bg rounded-xl font-bold text-[15px] text-text-main active:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {isReanalyzing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {isReanalyzing ? '重新分析中...' : '重新分析内容'}
          </button>
          <button onClick={handleExport} className="w-full h-14 bg-secondary-bg rounded-xl font-bold text-[15px] text-text-main active:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            <Download size={18} />
            导出完整播客
          </button>
          <button onClick={handleCopyContent} className="w-full h-14 bg-secondary-bg rounded-xl font-bold text-[15px] text-text-main active:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            <Copy size={18} />
            复制文稿
          </button>
          <button onClick={() => setIsEditing(true)} className="w-full h-14 bg-secondary-bg rounded-xl font-bold text-[15px] text-text-main active:bg-gray-100 transition-colors flex items-center justify-center gap-2">
            <Edit3 size={18} />
            编辑文稿
          </button>
          <button onClick={() => { setIsMoreModalOpen(false); setShowDeleteConfirm(true); }} className="w-full h-14 bg-secondary-bg rounded-xl font-bold text-[15px] text-red-500 active:bg-red-50 transition-colors flex items-center justify-center gap-2">
            <Trash2 size={18} />
            删除这条笔记
          </button>
        </div>
      </div>
    </div>
  );

  const DeleteConfirmModal = () => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
      <div className="relative w-full max-w-[320px] bg-white rounded-[20px] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Trash2 size={24} className="text-red-500" />
        </div>
        <h3 className="text-[16px] font-bold text-text-main text-center mb-2">确认删除</h3>
        <p className="text-[13px] text-text-gray text-center mb-6 leading-relaxed">删除后无法恢复，确定要删除这条播客吗？</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-11 bg-secondary-bg rounded-xl font-bold text-[14px] text-text-main active:bg-gray-100">取消</button>
          <button onClick={handleDelete} className="flex-1 h-11 bg-red-500 rounded-xl font-bold text-[14px] text-white active:bg-red-600">删除</button>
        </div>
      </div>
    </div>
  );

  const EditModal = () => (
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
      <div className="relative w-full max-w-[390px] bg-white rounded-t-[24px] p-6 pb-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[18px] font-bold text-text-main">编辑文稿</h2>
          <button onClick={() => setIsEditing(false)} className="p-2 text-text-gray"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-gray px-1">标题</label>
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full h-12 bg-secondary-bg border-none rounded-xl px-4 text-[15px] font-bold text-text-main outline-none focus:ring-1 focus:ring-primary/20" />
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-gray px-1">完整文稿</label>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full h-64 bg-secondary-bg border-none rounded-xl px-4 py-3 text-[14px] text-text-main leading-relaxed outline-none focus:ring-1 focus:ring-primary/20 resize-none" />
          </div>
        </div>
        <button onClick={handleSaveEdit} className="w-full h-12 bg-primary text-white rounded-xl font-bold text-[15px] mt-4 active:scale-[0.98] flex items-center justify-center gap-2">
          <Check size={18} />
          保存修改
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Top Nav */}
      <div className="h-[52px] px-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-text-main active:scale-95 transition-transform">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-1">
          <button onClick={handleShare} className="p-2 text-text-main active:scale-95 transition-transform"><Share2 size={20} /></button>
          <button onClick={() => setIsMoreModalOpen(true)} className="p-2 text-text-main active:scale-95 transition-transform"><MoreHorizontal size={20} /></button>
        </div>
      </div>

      {/* Scrollable Content - pb 增大确保不被底部栏遮挡 */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-[160px]">
        {/* Vinyl Player */}
        <div className="py-8 border-b border-border-color mb-8">
          <VinylPlayer note={note} isPlaying={isPlaying} onPlayToggle={setIsPlaying} onTimeUpdate={setCurrentTime} seekToTime={seekToTime} />
        </div>

        {/* Info */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={`px-2.5 py-1 bg-gradient-to-br ${style.bg} text-white text-[10px] font-bold rounded-[6px] shadow-sm`}>
              {note.source || '播客'}
            </span>
            {note.promptMode && note.promptMode !== 'default' && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-[4px] border border-amber-100">
                {PROMPT_MODE_LABELS[note.promptMode] || note.promptMode}
              </span>
            )}
            {note.topic && <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-[4px]">{note.topic}</span>}
          </div>
          <h1 className="text-[22px] font-bold text-text-main leading-tight mb-4">{note.title}</h1>
          {note.summary && (
            <p className="text-[14px] text-text-gray leading-relaxed mb-4 bg-secondary-bg/50 rounded-xl p-4 border border-border-color/50">
              {note.summary}
            </p>
          )}
          <div className="flex items-center gap-4 text-[12px] text-text-gray font-medium opacity-60">
            <div className="flex items-center gap-1.5"><Clock size={14} /><span>{note.duration || '15:00'}</span></div>
            <span>{new Date(note.createdAt || Date.now()).toLocaleDateString()}</span>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-4 mb-6 border-b border-border-color pb-2">
          <button onClick={() => setViewMode('points')} className={`text-[13px] font-bold uppercase tracking-widest pb-2 transition-all ${viewMode === 'points' ? 'text-primary border-b-2 border-primary' : 'text-text-gray opacity-40'}`}>要点导航</button>
          <button onClick={() => setViewMode('full')} className={`text-[13px] font-bold uppercase tracking-widest pb-2 transition-all ${viewMode === 'full' ? 'text-primary border-b-2 border-primary' : 'text-text-gray opacity-40'}`}>完整文案</button>
        </div>

        {/* Content */}
        {(note.points && note.points.length > 0) ? (
          viewMode === 'points' ? (
            <div className="space-y-1">
              {note.points.map((point) => (
                <div key={point.id} onClick={() => handlePointClick(point.time)} className={`flex gap-4 py-4 group transition-all duration-500 cursor-pointer rounded-xl px-2 ${activePointId === point.id ? 'bg-secondary-bg/60' : ''}`}>
                  <div className="flex flex-col items-center shrink-0 w-12">
                    <div className={`text-[11px] font-bold h-6 flex items-center ${activePointId === point.id ? 'text-primary' : 'text-text-gray'}`}>{point.time}</div>
                    <div className={`w-[2px] flex-1 bg-gray-100 mt-2 ${activePointId === point.id ? 'bg-primary/30' : ''}`} />
                  </div>
                  <div className="flex-1 pb-2">
                    <h3 className={`text-[16px] font-bold leading-tight transition-all ${activePointId === point.id ? 'text-text-main' : 'text-text-main opacity-60'}`}>{point.title}</h3>
                    <p className={`text-[14px] text-text-gray mt-2 leading-relaxed transition-all ${activePointId === point.id ? 'opacity-100' : 'opacity-40'}`}>{point.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="animate-in fade-in duration-500 pb-10">
              <div className="text-[15px] text-text-main leading-[1.9] font-medium whitespace-pre-wrap">
                {note.fullContent || note.points.map(p => `[${p.time}] ${p.title}\n${p.content}`).join('\n\n')}
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
            <p className="text-[14px] text-text-gray">正在生成文稿内容...</p>
          </div>
        )}
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-white/90 backdrop-blur-md border-t border-border-color flex items-center px-6 justify-between z-50">
        <button onClick={() => setIsBookmarked(!isBookmarked)} className={`flex items-center gap-2 font-bold active:scale-95 transition-all ${isBookmarked ? 'text-primary' : 'text-text-main'}`}>
          <Bookmark size={20} fill={isBookmarked ? "currentColor" : "none"} />
          <span className="text-[14px]">{isBookmarked ? '已收藏' : '收藏'}</span>
        </button>
        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-full font-bold text-[14px] active:scale-95 transition-all shadow-lg shadow-black/10">
          <Edit3 size={18} />
          编辑文稿
        </button>
      </div>

      {isMoreModalOpen && <MoreOptionsModal />}
      {showDeleteConfirm && <DeleteConfirmModal />}
      {isEditing && <EditModal />}
    </div>
  );
};

export default NoteDetail;
