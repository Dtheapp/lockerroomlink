/**
 * LandscapeNotice
 * Full-screen overlay shown when a phone is held in landscape. Some views
 * (like chat) are only usable in portrait, so this prompts the user to rotate.
 *
 * Only triggers on phone-sized viewports in landscape (short side), so it
 * never shows on tablets/desktops.
 */

import React, { useEffect, useState } from 'react';
import { RotateCw, Smartphone } from 'lucide-react';

export const LandscapeNotice: React.FC<{ featureName?: string }> = ({ featureName = 'This feature' }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = () => {
      const landscape = window.matchMedia('(orientation: landscape)').matches;
      // A phone in landscape has a short viewport height; tablets/desktops don't.
      const isPhone = window.innerHeight < 600;
      setShow(landscape && isPhone);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-zinc-950 text-white p-6 text-center">
      <div className="relative">
        <Smartphone className="w-16 h-16 text-purple-400" />
        <RotateCw className="w-7 h-7 text-amber-400 absolute -right-3 -top-2 animate-spin" style={{ animationDuration: '3s' }} />
      </div>
      <h2 className="text-xl font-bold">Please rotate your phone</h2>
      <p className="text-sm text-slate-300 max-w-xs">
        {featureName} works best in <span className="font-semibold text-white">portrait mode</span>. Flip your phone upright to continue.
      </p>
    </div>
  );
};

export default LandscapeNotice;
