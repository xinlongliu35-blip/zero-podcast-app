import React from 'react';
import { X, ArrowDown } from 'lucide-react';
import { useStore } from '../data/store';

const TutorialModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Skip Button */}
      <button 
        onClick={onClose}
        className="absolute top-10 right-6 bg-white/20 backdrop-blur-md border border-white/30 text-white rounded-full px-4 py-2 text-[13px] font-bold active:scale-95 transition-all"
      >
        跳过
      </button>

      {/* Modal Content */}
      <div className="relative w-full max-w-[320px] bg-white rounded-[20px] border-2 border-primary p-6 shadow-float animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center mb-6">
          <div className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest">
            02 / 12
          </div>
          <span className="text-[12px] text-text-gray font-medium">zero教程</span>
        </div>

        <h2 className="text-[22px] font-bold text-primary mb-4">笔记生成入口</h2>
        
        <p className="text-[14px] text-text-gray leading-relaxed font-medium">
          点击底部的「+」号，随时随地开启智能堆叠笔记。无论是微信文章、B站视频、还是小红书精选，只需一键粘贴即可生成微缩瓷盆栽，积累深度认知。
        </p>

        {/* Down Arrow */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white animate-bounce">
          <ArrowDown size={32} />
        </div>
      </div>

      {/* Pulse Effect for Bottom Button (Visual Guide) */}
      <div className="absolute bottom-[28px] left-1/2 -translate-x-1/2 w-16 h-16 bg-primary rounded-full animate-ping opacity-20 pointer-events-none" />
    </div>
  );
};

export default TutorialModal;
