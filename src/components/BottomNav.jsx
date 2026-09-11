import { useNavigate, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Box, Plus } from 'lucide-react';
import { useStore } from '../data/store';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setInputModalOpen = useStore((state) => state.setInputModalOpen);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="absolute bottom-0 w-full h-[72px] bg-white border-t border-border-color flex items-center justify-between px-10 pb-2 z-50">
      <div 
        onClick={() => navigate('/')}
        className={`flex flex-col items-center cursor-pointer active:scale-95 transition-all ${isActive('/') ? 'text-text-main' : 'text-text-gray opacity-40'}`}
      >
        <HomeIcon size={24} strokeWidth={isActive('/') ? 2.5 : 2} />
        <span className="text-[11px] mt-1 font-bold">首页</span>
      </div>

      <div className="relative -mt-10">
        <button 
          className="w-[56px] h-[56px] bg-primary rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all border-4 border-white"
          onClick={() => {
            console.log('Plus clicked');
            setInputModalOpen(true);
          }}
        >
          <Plus color="white" size={28} strokeWidth={3} />
        </button>
      </div>

      <div 
        onClick={() => navigate('/library')}
        className={`flex flex-col items-center cursor-pointer active:scale-95 transition-all ${isActive('/library') ? 'text-text-main' : 'text-text-gray opacity-40'}`}
      >
        <Box size={24} strokeWidth={isActive('/library') ? 2.5 : 2} />
        <span className="text-[11px] mt-1 font-bold">库仓</span>
      </div>
    </nav>
  );
};

export default BottomNav;