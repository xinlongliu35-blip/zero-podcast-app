import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Link2, FileText, Check, Sparkles, Brain, Zap, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';

// 检测是否是视频平台（抖音/B站），这类需要下载音频+ASR，耗时较长
const isVideoPlatform = (url) => {
  return /douyin\.com|v\.douyin|bilibili\.com|b23\.tv/i.test(url);
};

// 提示词模式配置
const PROMPT_MODES = [
  { id: 'default', label: '真实还原', desc: '严格还原内容', icon: FileText },
  { id: 'critical', label: '批判性思维', desc: '加入质疑与多角度思考', icon: Brain },
  { id: 'deep', label: '深度分析', desc: '挖掘底层逻辑与延伸', icon: Zap },
  { id: 'custom', label: '自定义', desc: '自由定义附加要求', icon: Wand2 },
];

const LinkInputModal = ({ isOpen, onClose }) => {
  const addNote = useStore((state) => state.addNote);
  const settings = useStore((state) => state.settings);
  const navigate = useNavigate();

  const [inputType, setInputType] = useState('url'); // 'url' or 'text'
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [remark, setRemark] = useState('');
  const [mode, setMode] = useState('concise');
  const [promptMode, setPromptMode] = useState(settings.promptMode || 'default');
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('正在分析并生成...');
  const stageTimer = useRef(null);

  // 视频平台的分阶段提示
  const VIDEO_STAGES = [
    { text: '正在解析视频链接...', delay: 0 },
    { text: '正在下载视频音频...', delay: 8000 },
    { text: '正在语音识别中...', delay: 25000 },
    { text: '正在生成播客文稿...', delay: 90000 },
  ];

  const startStageRotation = (isVideo) => {
    if (!isVideo) {
      setLoadingText('正在生成播客文稿...');
      return;
    }
    VIDEO_STAGES.forEach((stage) => {
      const t = setTimeout(() => setLoadingText(stage.text), stage.delay);
      stageTimer.current = t;
    });
  };

  const clearStageRotation = () => {
    if (stageTimer.current) {
      clearTimeout(stageTimer.current);
      stageTimer.current = null;
    }
  };

  useEffect(() => {
    return () => clearStageRotation();
  }, []);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    const isText = inputType === 'text';
    if (isText) {
      if (!text || text.trim().length < 10) {
        alert('请输入至少 10 个字符的文本内容');
        return;
      }
    } else {
      if (!url) return;
    }

    const video = !isText && isVideoPlatform(url);
    setIsLoading(true);
    startStageRotation(video);

    try {
      const endpoint = isText ? '/api/analyze-text' : '/api/analyze';
      const body = isText
        ? { text, title: textTitle, remark, apiKey: settings.apiKey, promptMode, customPrompt }
        : { url, remark, mode, apiKey: settings.apiKey, promptMode, customPrompt };

      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const newNoteId = Date.now();
      addNote({
        id: newNoteId,
        ...data,
        createdAt: Date.now(),
        date: new Date().toLocaleDateString(),
        folder: data.topic || '认知思维',
        promptMode: promptMode,
      });
      onClose();
      navigate(`/note/${newNoteId}`);
    } catch (err) {
      console.error(err);
      alert(`生成失败：${err.message}\n\n请确认后端服务已启动，且 Python 依赖已安装。`);
    } finally {
      setIsLoading(false);
      clearStageRotation();
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-[390px] bg-white rounded-t-[24px] p-6 pb-10 animate-in slide-in-from-bottom-full duration-300 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-[20px] font-bold text-text-main">生成新播客</h2>
          <button onClick={onClose} className="p-2 text-text-gray active:scale-90 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          {/* 输入类型切换 */}
          <div className="flex gap-2 p-1 bg-secondary-bg rounded-xl">
            <button
              onClick={() => setInputType('url')}
              className={`flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${inputType === 'url' ? 'bg-white text-text-main shadow-sm' : 'text-text-gray opacity-60'}`}
            >
              <Link2 size={14} />
              链接
            </button>
            <button
              onClick={() => setInputType('text')}
              className={`flex-1 h-10 rounded-lg text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all ${inputType === 'text' ? 'bg-white text-text-main shadow-sm' : 'text-text-gray opacity-60'}`}
            >
              <FileText size={14} />
              文本
            </button>
          </div>

          {/* 链接输入 */}
          {inputType === 'url' && (
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-text-gray flex items-center gap-1.5 px-1">
                <Link2 size={14} />
                粘贴链接 (支持抖音、B站、小红书、公众号)
              </label>
              <textarea
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-24 bg-secondary-bg border-none rounded-xl px-4 py-3 text-[14px] text-text-main placeholder:text-text-gray/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none font-medium"
              />
            </div>
          )}

          {/* 文本输入 */}
          {inputType === 'text' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-text-gray flex items-center gap-1.5 px-1">
                  <FileText size={14} />
                  标题 (可选)
                </label>
                <input
                  type="text"
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="给这段内容起个标题"
                  className="w-full h-11 bg-secondary-bg border-none rounded-xl px-4 text-[14px] text-text-main placeholder:text-text-gray/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-text-gray flex items-center gap-1.5 px-1">
                  <FileText size={14} />
                  粘贴文本内容
                </label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="把文章、笔记、聊天记录等文本粘贴到这里..."
                  className="w-full h-40 bg-secondary-bg border-none rounded-xl px-4 py-3 text-[14px] text-text-main placeholder:text-text-gray/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none font-medium leading-relaxed"
                />
                <p className="text-[11px] text-text-gray/50 font-medium px-1">
                  已输入 {text.length} 字
                </p>
              </div>
            </div>
          )}

          {/* 备注输入 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-gray flex items-center gap-1.5 px-1">
              <Sparkles size={14} />
              添加备注 (可选)
            </label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="例如：重点关注结尾的总结"
              className="w-full h-12 bg-secondary-bg border-none rounded-xl px-4 text-[14px] text-text-main placeholder:text-text-gray/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all font-medium"
            />
          </div>

          {/* 提示词模式选择 */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-text-gray flex items-center gap-1.5 px-1">
              <Brain size={14} />
              播客风格
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROMPT_MODES.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPromptMode(m.id)}
                    className={`h-16 rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all ${promptMode === m.id ? 'bg-primary text-white border-primary' : 'bg-white border-border-color text-text-gray'}`}
                  >
                    <Icon size={16} />
                    <span className="text-[12px] font-bold">{m.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-text-gray/50 font-medium px-1">
              {PROMPT_MODES.find(m => m.id === promptMode)?.desc}
            </p>
          </div>

          {/* 自定义提示词输入 */}
          {promptMode === 'custom' && (
            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="text-[12px] font-bold text-text-gray flex items-center gap-1.5 px-1">
                <Wand2 size={14} />
                自定义附加要求
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：请加入经济学视角的分析，并用生活化的例子解释..."
                className="w-full h-24 bg-secondary-bg border-none rounded-xl px-4 py-3 text-[13px] text-text-main placeholder:text-text-gray/40 outline-none focus:ring-1 focus:ring-primary/20 transition-all resize-none font-medium leading-relaxed"
              />
            </div>
          )}

          {/* 精简/完整版选择（仅链接模式） */}
          {inputType === 'url' && (
            <div className="flex gap-3">
              <button
                onClick={() => setMode('concise')}
                className={`flex-1 h-12 rounded-xl border flex items-center justify-center gap-2 transition-all text-[14px] font-bold ${mode === 'concise' ? 'bg-primary text-white border-primary' : 'bg-white border-border-color text-text-gray'}`}
              >
                {mode === 'concise' && <Check size={16} />}
                精简版
              </button>
              <button
                onClick={() => setMode('full')}
                className={`flex-1 h-12 rounded-xl border flex items-center justify-center gap-2 transition-all text-[14px] font-bold ${mode === 'full' ? 'bg-primary text-white border-primary' : 'bg-white border-border-color text-text-gray'}`}
              >
                {mode === 'full' && <Check size={16} />}
                完整版
              </button>
            </div>
          )}

          {/* 生成按钮 */}
          <button
            disabled={isLoading || (inputType === 'url' ? !url : text.trim().length < 10)}
            onClick={handleGenerate}
            className="w-full h-14 bg-primary text-white rounded-xl font-bold text-[16px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {loadingText}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                生成播客
              </>
            )}
          </button>

          <p className="text-center text-[11px] text-text-gray/60 font-medium">
            {inputType === 'url' && isVideoPlatform(url)
              ? '视频内容需下载音频并语音识别，约需 1-3 分钟'
              : '生成播客将调用 AI 生成高质量文稿'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LinkInputModal;
