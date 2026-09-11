import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Mic, ArrowLeft, ChevronRight, Volume2, Globe, Brain, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../data/store';

const Settings = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, skipSplashScreen, setSkipSplashScreen } = useStore();
  const [localApiKey, setLocalApiKey] = useState(settings.apiKey || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [localCustomPrompt, setLocalCustomPrompt] = useState(settings.customPrompt || '');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [localPromptMode, setLocalPromptMode] = useState(settings.promptMode || 'default'); // 'success', 'error'

  useEffect(() => {
    setLocalApiKey(settings.apiKey || '');
  }, [settings.apiKey]);

  const toggle = (key) => updateSettings({ [key]: !settings[key] });
  
  const handleApiKeyBlur = async () => {
    if (localApiKey === settings.apiKey) return;
    
    updateSettings({ apiKey: localApiKey });
    
    if (localApiKey) {
      setIsVerifying(true);
      setVerifyStatus(null);
      try {
        // Simple verification request to DeepSeek (or your backend)
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localApiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{role: "user", content: "hi"}],
            max_tokens: 1
          })
        });
        
        if (response.ok) {
          setVerifyStatus('success');
        } else {
          setVerifyStatus('error');
        }
      } catch (err) {
        setVerifyStatus('error');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleVoiceChange = (voice) => updateSettings({ voice });

  const handleCustomPromptBlur = () => {
    if (localCustomPrompt !== settings.customPrompt) {
      updateSettings({ customPrompt: localCustomPrompt });
    }
  };

  const handlePromptModeChange = (mode) => {
    setLocalPromptMode(mode);
    updateSettings({ promptMode: mode });
  };

  const promptModes = [
    { id: 'default', label: '真实还原' },
    { id: 'critical', label: '批判性思维' },
    { id: 'deep', label: '深度分析' },
    { id: 'custom', label: '自定义' },
  ];

  const voices = [
    { id: 'gentle', label: '温柔女声' },
    { id: 'mature', label: '成熟男声' },
    { id: 'dynamic', label: '活力女声' },
    { id: 'calm', label: '冷静男声' }
  ];

  return (
    <div className="flex flex-col min-h-full pb-32 bg-white">
      {/* Top Header */}
      <div className="h-[52px] px-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-text-main active:scale-95 transition-transform"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-[16px] font-bold text-text-main">设置</h1>
        <div className="w-9" /> {/* Spacer */}
      </div>

      <div className="px-5 pt-4">
        {/* User Profile */}
        <div className="bg-secondary-bg rounded-[16px] p-5 flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-white text-[18px] font-bold">
            Z
          </div>
          <div>
            <div className="text-[17px] font-bold text-text-main">Zero 用户</div>
            <div className="text-[12px] text-text-gray font-medium mt-0.5 opacity-60">
              已累计分析 13 条播客
            </div>
          </div>
        </div>

        {/* AI API Configuration */}
        <div className="mb-8">
          <h3 className="text-[13px] font-bold text-text-gray uppercase tracking-widest mb-4 px-1">AI 接口配置</h3>
          <div className="bg-white rounded-[16px] border border-border-color p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-text-main">
              <Key size={16} />
              <span className="text-[14px] font-bold">API Key</span>
            </div>
            <input 
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              onBlur={handleApiKeyBlur}
              placeholder="输入您的 OpenAI/Claude API Key"
              className={`w-full h-12 bg-secondary-bg border-none rounded-xl px-4 text-[13px] font-medium outline-none focus:ring-2 ${verifyStatus === 'success' ? 'focus:ring-green-500/20' : verifyStatus === 'error' ? 'focus:ring-red-500/20' : 'focus:ring-black/5'}`}
            />
            {isVerifying && <p className="text-[10px] text-text-gray mt-2 px-1 animate-pulse">正在验证 API Key...</p>}
            {verifyStatus === 'success' && <p className="text-[10px] text-green-600 mt-2 px-1 font-bold">✓ API Key 验证通过</p>}
            {verifyStatus === 'error' && <p className="text-[10px] text-red-600 mt-2 px-1 font-bold">✗ API Key 验证失败，请检查网络或 Key 是否有效</p>}
            <p className="text-[11px] text-text-gray mt-3 px-1 leading-relaxed opacity-60">
              您的 Key 将仅保存在本地浏览器中，用于识别视频链接及生成播客内容。
            </p>
          </div>
        </div>

        {/* Podcast Customization */}
        <div className="mb-8">
          <h3 className="text-[13px] font-bold text-text-gray uppercase tracking-widest mb-4 px-1">播客偏好</h3>
          <div className="bg-white rounded-[16px] border border-border-color overflow-hidden">
            {/* Voice Selection */}
            <div className="p-4 border-b border-border-color">
              <div className="flex items-center gap-2 mb-4 text-text-main">
                <Volume2 size={16} />
                <span className="text-[14px] font-bold">播客音色</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {voices.map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => handleVoiceChange(voice.id)}
                    className={`h-10 rounded-lg text-[13px] font-bold transition-all ${settings.voice === voice.id ? 'bg-primary text-white' : 'bg-secondary-bg text-text-gray'}`}
                  >
                    {voice.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Language Toggle */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe size={18} className="text-text-main/40" />
                <span className="text-[14px] font-bold text-text-main">英文原声解析</span>
              </div>
              <div 
                onClick={() => toggle('englishEnabled')}
                className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-all ${settings.englishEnabled ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-all ${settings.englishEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* AI 提示词设置 */}
        <div className="mb-8">
          <h3 className="text-[13px] font-bold text-text-gray uppercase tracking-widest mb-4 px-1">AI 提示词</h3>

          {/* 默认风格 */}
          <div className="bg-white rounded-[16px] border border-border-color p-4 mb-4">
            <div className="flex items-center gap-2 mb-3 text-text-main">
              <Brain size={16} />
              <span className="text-[14px] font-bold">默认播客风格</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {promptModes.map(m => (
                <button
                  key={m.id}
                  onClick={() => handlePromptModeChange(m.id)}
                  className={`h-10 rounded-lg text-[13px] font-bold transition-all ${localPromptMode === m.id ? 'bg-primary text-white' : 'bg-secondary-bg text-text-gray'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-gray mt-3 px-1 leading-relaxed opacity-60">
              新建播客时默认使用的风格，生成时仍可切换。
            </p>
          </div>

          {/* 自定义提示词 */}
          <div className="bg-white rounded-[16px] border border-border-color p-4 mb-4">
            <div className="flex items-center gap-2 mb-3 text-text-main">
              <Brain size={16} />
              <span className="text-[14px] font-bold">自定义附加要求</span>
            </div>
            <textarea
              value={localCustomPrompt}
              onChange={(e) => setLocalCustomPrompt(e.target.value)}
              onBlur={handleCustomPromptBlur}
              placeholder="例如：请加入经济学视角的分析，并用生活化的例子解释..."
              className="w-full h-28 bg-secondary-bg border-none rounded-xl px-4 py-3 text-[13px] text-text-main placeholder:text-text-gray/40 outline-none focus:ring-1 focus:ring-primary/20 resize-none font-medium leading-relaxed"
            />
            <p className="text-[11px] text-text-gray mt-2 px-1 leading-relaxed opacity-60">
              当播客风格选择"自定义"时，这段文字会追加到系统提示词后。
            </p>
          </div>

          {/* 查看系统提示词 */}
          <div className="bg-white rounded-[16px] border border-border-color overflow-hidden">
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="w-full px-5 py-4 flex items-center justify-between active:bg-secondary-bg transition-colors"
            >
              <span className="text-[14px] font-bold text-text-main">查看系统提示词</span>
              <ChevronDown size={18} className={`text-text-gray transition-transform ${showSystemPrompt ? 'rotate-180' : ''}`} />
            </button>
            {showSystemPrompt && (
              <div className="px-5 pb-5 animate-in fade-in duration-300">
                <div className="bg-secondary-bg rounded-xl p-4 text-[12px] text-text-gray leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto no-scrollbar">
{`你是一个极简风格的播客制作专家，你的任务是对用户提供的视频内容进行【100% 真实且完整的还原性复述】。

【制作规则】
1. 绝对真实：严禁任何形式的自我发挥、虚构背景、胡编乱造。
2. 拒绝幻觉：内容不全时仅基于现有信息概括，宁可简短也不杜撰。
3. 第一人称还原：以播客主持人"我"的身份，用口语化中文讲述。
4. 结构化：开场点题 → 内容复述 → 真实摘要。
5. 音文配套：划分为 10-15 个段落，每段带时间戳。

【可选附加风格】
- 批判性思维：增加对观点的质疑与多角度思考
- 深度分析：挖掘底层逻辑、背景原因与延伸启发
- 自定义：使用你在上方填写的附加要求`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System Settings */}
        <div className="mb-8">
          <h3 className="text-[13px] font-bold text-text-gray uppercase tracking-widest mb-4 px-1">系统</h3>
          <div className="bg-white rounded-[16px] border border-border-color overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-border-color">
              <span className="text-[14px] font-bold text-text-main">触感反馈</span>
              <button 
                onClick={() => toggle('haptic')}
                className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-all ${settings.haptic ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-all ${settings.haptic ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="px-5 py-4 flex items-center justify-between border-b border-border-color">
              <span className="text-[14px] font-bold text-text-main">跳过启动动画</span>
              <button 
                onClick={() => setSkipSplashScreen(!skipSplashScreen)}
                className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-all ${skipSplashScreen ? 'bg-primary' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-all ${skipSplashScreen ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
            <button 
              onClick={() => alert('zero v2.0.0\n一款专注于 AI 播客生成的极简应用。')}
              className="w-full px-5 py-4 flex items-center justify-between text-text-main active:bg-secondary-bg transition-colors"
            >
              <span className="text-[14px] font-bold">关于 zero</span>
              <ChevronRight size={18} className="text-text-gray opacity-40" />
            </button>
          </div>
        </div>

        <div className="text-center pt-8 pb-10 opacity-20">
          <p className="text-[10px] font-bold tracking-[0.3em]">ZERO APP VERSION 2.0</p>
          <p className="text-[10px] font-medium mt-1 uppercase tracking-widest">Minimalist Podcast Edition</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;