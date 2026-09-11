import React from 'react';

const FolderCard = ({ folder, onClick }) => {
  return (
    <div 
      className="bg-white rounded-[16px] p-[16px] h-[120px] shadow-sm border border-border-color flex flex-col relative active:scale-[0.96] transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div 
          className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[10px] font-black text-white shadow-sm"
          style={{ backgroundColor: folder.icon === '文' ? '#1A1A1A' : folder.icon === 'B' ? '#FB7299' : '#FF2442' }}
        >
          {folder.icon}
        </div>
        <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
          {folder.count}
        </div>
      </div>
      <div className="mt-auto">
        <div className="text-[16px] font-semibold text-text-main">
          {folder.name}
        </div>
        <div className="text-[11px] text-text-gray font-medium mt-0.5">
          最近更新: {folder.update}
        </div>
      </div>
    </div>
  );
};

export default FolderCard;