import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Library from './pages/Library';
import NoteDetail from './pages/NoteDetail';
import Settings from './pages/Settings';
import BottomNav from './components/BottomNav';
import TutorialModal from './components/TutorialModal';
import LinkInputModal from './components/LinkInputModal';
import SplashScreen from './components/SplashScreen';
import { useStore } from './data/store';

function App() {
  const { currentTutorialStep, setTutorialStep, isInputModalOpen, setInputModalOpen, skipSplashScreen } = useStore();
  const [hasStarted, setHasStarted] = useState(false);
  const showTutorial = currentTutorialStep === 0;

  return (
    <Router>
      <div className="phone-container">
        {!hasStarted && (
          <SplashScreen onFinish={() => setHasStarted(true)} />
        )}
        {/* Status Bar Simulator */}
        <div className="h-11 px-9 flex items-center justify-between text-[15px] font-semibold tracking-tight z-50 relative bg-background">
          <span>09:41</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-2 bg-black rounded-[2px] opacity-10"></div>
            <div className="w-4 h-2 bg-black rounded-[2px] opacity-20"></div>
            <div className="w-6 h-3 border border-black/20 rounded-[4px] relative">
              <div className="absolute left-0.5 top-0.5 bottom-0.5 w-[70%] bg-black rounded-[1px]"></div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="content-scroll-area bg-background">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/library" element={<Library />} />
            <Route path="/library/:folderId" element={<Home isFolderView={true} />} />
            <Route path="/note/:id" element={<NoteDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>

        {/* Navigation */}
        <BottomNav />
        
        {/* Modals */}
        <LinkInputModal 
          isOpen={isInputModalOpen} 
          onClose={() => setInputModalOpen(false)} 
        />
        
        <TutorialModal 
          isOpen={showTutorial} 
          onClose={() => setTutorialStep(1)} 
        />
      </div>
    </Router>
  );
}

export default App;