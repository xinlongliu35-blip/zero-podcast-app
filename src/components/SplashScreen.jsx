import React, { useEffect, useRef, useState } from 'react';
import { Experience } from '../animation/experience';

const SplashScreen = ({ onFinish }) => {
  const containerRef = useRef(null);
  const experienceRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [flyingPetal, setFlyingPetal] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const initializingRef = useRef(false);

  useEffect(() => {
    let experience = null;
    let isMounted = true;

    const initExperience = async () => {
      if (!containerRef.current || initializingRef.current) return;
      
      // Wait for container to have dimensions
      if (containerRef.current.clientWidth === 0) {
        if (isMounted) requestAnimationFrame(initExperience);
        return;
      }
      
      initializingRef.current = true;
      console.log('Initializing Experience...');
      
      try {
        experience = new Experience();
        experienceRef.current = experience;
        
        await experience.initialize(containerRef.current);
        console.log('Experience initialized successfully');
        setIsLoaded(true);
        
        if (experience.orchestrator) {
          console.log('Setting completion callback');
          experience.orchestrator.setCompletionCallback(() => {
            console.log('Gommage effect complete, starting transition...');
            setIsFadingOut(true);
            
            // Trigger flying petal animation
            const logoRose = document.getElementById('brand-logo-rose');
            if (logoRose && containerRef.current) {
              const rect = logoRose.getBoundingClientRect();
              const containerRect = containerRef.current.getBoundingClientRect();
              
              // The phone-container has scale(0.85) applied
              const containerScale = 0.85;
              
              // Start from center of the splash screen (relative to containerRect)
              const startX = (containerRef.current.clientWidth / 2);
              const startY = (containerRef.current.clientHeight / 2);
              
              // Calculate target position relative to the splash container top-left
              // rect.left/top are viewport coordinates, containerRect.left/top are also viewport coordinates
              // The difference is visual pixels, so we divide by scale to get internal container pixels
              const targetXInContainer = (rect.left - containerRect.left) / containerScale;
              const targetYInContainer = (rect.top - containerRect.top) / containerScale;
              
              // The black rose in SVG is at (10, 20) in a 100x40 viewBox
              // We need to target the actual position of that rose petal within the logoRose div
              const roseWidth = rect.width / containerScale;
              const roseHeight = rect.height / containerScale;
              
              // Fine-tuned target within the brand-logo-rose div to hit the black petal
              const blackPetalOffsetX = roseWidth * 0.2; 
              const blackPetalOffsetY = roseHeight * 0.45;
              
              const finalTargetX = targetXInContainer + blackPetalOffsetX;
              const finalTargetY = targetYInContainer + blackPetalOffsetY;
              
              setFlyingPetal({
                startX,
                startY,
                targetX: finalTargetX - startX,
                targetY: finalTargetY - startY
              });

              // Finish after petal animation completes
              setTimeout(onFinish, 1400); 
            } else {
              onFinish();
            }
          });
        }
        
        console.log('Setting isLoaded to true');
        setIsLoaded(true);
      } catch (err) {
        console.error('Splash screen init error:', err);
        setIsLoaded(true); 
        // Fallback: If init fails, allow user to enter the app
        if (initializingRef.current) {
          setTimeout(onFinish, 1000);
        }
      }
    };

    initExperience();

    return () => {
      isMounted = false;
      if (experience) {
        experience.dispose();
      }
    };
  }, [onFinish]);

  const handleStart = () => {
    if (experienceRef.current && experienceRef.current.orchestrator) {
      experienceRef.current.orchestrator.triggerGommage();
    }
  };

  return (
    <>
      <div className={`splash-container ${isFadingOut ? 'fade-out' : ''}`}>
        <div id="progress-container" className="code-progress">
          <div className="code-progress__line">
            <span className="code-progress__label">BOOTING:</span>
            <span className="code-progress__bar-bg">
              <span id="progress-bar" className="code-progress__bar-fill"></span>
            </span>
            <span id="progress-percent" className="code-progress__value">0%</span>
          </div>
        </div>
        
        <div id="canvas-container" ref={containerRef}></div>
        
        <div id="control-ui-container" style={{ opacity: isFadingOut ? 0 : 1, transition: 'opacity 0.3s' }}>
          <button 
            className={`E33-button ${isFadingOut ? 'disabled' : ''}`} 
            id="gommage-button"
            onClick={handleStart}
            disabled={isFadingOut}
          >
            Start
          </button>
        </div>
      </div>

      {flyingPetal && (
         <div 
           className="flying-petal animate-fly"
           style={{
             left: flyingPetal.startX,
             top: flyingPetal.startY,
             '--target-x': `${flyingPetal.targetX}px`,
             '--target-y': `${flyingPetal.targetY}px`,
             width: '120px', // Further increased from 100px
             height: '120px', // Further increased from 100px
             transform: 'translate(-50%, -50%)',
             opacity: isFadingOut ? 1 : 0
           }}
         >
           <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
             <path 
               d="M10,20 C15,5 25,5 30,15 C35,5 45,5 50,15 C50,25 40,35 30,38 C20,35 10,25 10,20 Z" 
               fill="#000000" 
               fillOpacity="0.6"
               transform="translate(20, 20) rotate(-15 30 20) scale(1.2)"
             />
           </svg>
         </div>
       )}
    </>
  );
};

export default SplashScreen;
