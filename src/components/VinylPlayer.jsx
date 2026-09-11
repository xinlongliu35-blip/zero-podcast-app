import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { useStore } from '../data/store';

const VinylPlayer = ({ note, isPlaying, onPlayToggle, onTimeUpdate, seekToTime }) => {
  const settings = useStore((state) => state.settings);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const utteranceRef = useRef(null);
  const timerRef = useRef(null);
  const progressRef = useRef(null);

  // Get content for playback
  const playbackContent = note.fullContent || note.points?.map(p => p.content).join(' ') || '';

  // Estimate duration: ~3.5 characters per second for Chinese
  const estimatedDuration = playbackContent.length / 3.5 || 300; // Fallback to 5 mins if no content

  useEffect(() => {
    setDuration(estimatedDuration);
  }, [note, estimatedDuration]);

  // Handle seeking from parent
  useEffect(() => {
    if (seekToTime !== undefined && seekToTime !== null) {
      handleSeek(seekToTime);
    }
  }, [seekToTime]);

  useEffect(() => {
    if (isPlaying) {
      startPlayback();
    } else {
      pausePlayback();
    }
    return () => pausePlayback();
  }, [isPlaying, note]);

  const startPlayback = () => {
    if (!playbackContent) return;
    
    window.speechSynthesis.cancel();
    
    // Calculate starting position in text
    const startCharIndex = Math.floor((currentTime / estimatedDuration) * playbackContent.length);
    const textToSpeak = playbackContent.substring(startCharIndex);
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    let voices = window.speechSynthesis.getVoices();
    
    const tryPlay = () => {
      const selectedVoice = voices.find(v => v.lang.includes('zh')) || voices[0];
      utterance.voice = selectedVoice;
      
      if (settings.voice === 'mature') {
        utterance.pitch = 0.8;
        utterance.rate = 0.9;
      } else if (settings.voice === 'gentle') {
        utterance.pitch = 1.1;
        utterance.rate = 1.0;
      }

      utterance.onstart = () => {
        const startTime = Date.now() - (currentTime * 1000);
        timerRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          if (elapsed <= estimatedDuration) {
            setCurrentTime(elapsed);
            if (onTimeUpdate) onTimeUpdate(elapsed);
          } else {
            onend();
          }
        }, 100);
      };

      const onend = () => {
        pausePlayback();
        onPlayToggle(false);
        setCurrentTime(0);
        if (onTimeUpdate) onTimeUpdate(0);
      };

      utterance.onend = onend;
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        tryPlay();
      };
    } else {
      tryPlay();
    }
  };

  const handleSeek = (time) => {
    const newTime = Math.max(0, Math.min(time, estimatedDuration));
    setCurrentTime(newTime);
    if (onTimeUpdate) onTimeUpdate(newTime);
    
    if (isPlaying) {
      // Restart playback from new position
      startPlayback();
    }
  };

  const onProgressBarClick = (e) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    handleSeek(percentage * estimatedDuration);
  };

  const pausePlayback = () => {
    window.speechSynthesis.cancel();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / estimatedDuration) * 100 || 0;

  return (
    <div className="flex flex-col items-center w-full max-w-[320px] mx-auto">
      {/* Black & White Minimalist Vinyl Disc */}
      <div 
        className="relative w-60 h-60 flex items-center justify-center cursor-pointer group"
        onClick={() => onPlayToggle(!isPlaying)}
      >
        {/* Needle */}
        <div className={`absolute -top-6 -right-4 w-24 h-1.5 bg-black origin-left z-40 transition-transform duration-700 rounded-full shadow-sm ${isPlaying ? 'rotate-[25deg]' : 'rotate-0'}`}>
           <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full border-2 border-white" />
        </div>

        {/* Vinyl Base */}
        <div className={`absolute inset-0 rounded-full bg-black shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-[8px] border-white overflow-hidden transition-transform duration-[15s] linear infinite ${isPlaying ? 'animate-spin' : ''}`}>
          <div className="absolute inset-0 opacity-40" style={{ background: 'repeating-radial-gradient(circle, #1a1a1a, #1a1a1a 1px, #000 2px, #000 4px)' }} />
          
          {/* Rose Pattern on Vinyl */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 100 100">
              <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="white" transform="rotate(0 50 50) translate(0, -10)" />
              <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="white" transform="rotate(72 50 50) translate(0, -10)" />
              <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="white" transform="rotate(144 50 50) translate(0, -10)" />
              <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="white" transform="rotate(216 50 50) translate(0, -10)" />
              <path d="M50 20C55 10 65 10 70 20C75 10 85 10 90 20C90 30 80 40 70 50C60 40 50 30 50 20Z" fill="white" transform="rotate(288 50 50) translate(0, -10)" />
            </svg>
          </div>
          
          <div className="absolute inset-0 opacity-10 bg-gradient-to-tr from-transparent via-white to-transparent" />
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full bg-white flex items-center justify-center border-[6px] border-black/5 z-10">
             <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gray-50 relative">
               <span className="text-[32px] font-black text-black/5 tracking-tighter">ZERO</span>
               {note.cover && (
                 <img 
                   src={note.cover} 
                   alt="" 
                   className="absolute inset-0 w-full h-full object-cover grayscale brightness-95 contrast-110" 
                 />
               )}
               <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] rounded-full" />
             </div>
          </div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-black rounded-full border border-white/20 z-20 shadow-inner" />
        </div>

        {/* Play/Pause Overlay */}
        <div className={`absolute inset-0 flex items-center justify-center z-30 transition-opacity duration-300 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
          <div className="w-14 h-14 bg-white/95 backdrop-blur-sm rounded-full flex items-center justify-center text-black shadow-2xl border border-black/5 active:scale-90 transition-all">
            {isPlaying ? <Pause size={28} /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </div>
        </div>
      </div>

      {/* Progress Bar & Controls */}
      <div className="w-full mt-10 px-2">
        <div className="flex justify-between items-center mb-2 text-[12px] font-bold text-text-main tracking-tighter">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(estimatedDuration)}</span>
        </div>
        <div 
          ref={progressRef}
          onClick={onProgressBarClick}
          className="h-1.5 bg-gray-100 rounded-full overflow-hidden cursor-pointer relative"
        >
          <div 
            className="h-full bg-black transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-8">
          <button 
            onClick={() => handleSeek(currentTime - 15)}
            className="text-text-gray opacity-40 hover:opacity-100 transition-opacity p-2"
          >
            <SkipBack size={24} />
          </button>
          <button 
            onClick={() => onPlayToggle(!isPlaying)}
            className="w-14 h-14 bg-black rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-all"
          >
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
          </button>
          <button 
            onClick={() => handleSeek(currentTime + 15)}
            className="text-text-gray opacity-40 hover:opacity-100 transition-opacity p-2"
          >
            <SkipForward size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VinylPlayer;