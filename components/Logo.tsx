
import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'default' | 'white';
  src?: string;
}

/**
 * Itoli Granito LLP - THE TILE COMPOSER
 * Component optimized for dynamic brand assets.
 */
const Logo: React.FC<LogoProps> = ({ className = "h-12", variant = 'default', src }) => {
  const [error, setError] = React.useState(false);

  // If no source is provided or image fails to load, we use a styled text-based fallback
  if (!src || error) {
    return (
      <div className={`${className} flex flex-col justify-center select-none`}>
        <span className={`text-2xl logo-font leading-none ${variant === 'white' ? 'text-white' : 'text-itoli'}`}>itoli</span>
        <span className={`tagline-font uppercase tracking-[0.3em] ${variant === 'white' ? 'text-white/60' : 'text-itoli/60'}`}>The Tile Composer</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center justify-center">
      <img 
        src={src} 
        alt="itoli - THE TILE COMPOSER" 
        className={`${className} object-contain`}
        style={{
          filter: variant === 'white' ? 'brightness(0) invert(1)' : 'none'
        }}
        onError={() => setError(true)}
      />
    </div>
  );
};

export default Logo;
