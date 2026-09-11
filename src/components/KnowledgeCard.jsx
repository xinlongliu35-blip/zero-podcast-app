import React from 'react';
import { Clock } from 'lucide-react';

const KnowledgeCard = ({ point }) => {
  return (
    <div className="bg-white rounded-[16px] p-5 shadow-card border border-border-color active:scale-[0.99] transition-all">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-primary/5 rounded-full border border-primary/10">
          <Clock size={12} className="text-primary" />
          <span className="text-[12px] font-bold text-primary">{point.time}</span>
        </div>
        <span className="text-[10px] font-bold text-text-gray tracking-widest uppercase">
          知识点 #{point.id}
        </span>
      </div>
      <h3 className="text-[16px] font-black text-text-main mb-2">{point.title}</h3>
      <p className="text-[13px] text-text-gray leading-[1.7] font-medium">{point.content}</p>
    </div>
  );
};

export default KnowledgeCard;