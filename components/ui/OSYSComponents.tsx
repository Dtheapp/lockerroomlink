import React from 'react';

// ============================================
// ANIMATED BACKGROUND WITH ORBS
// ============================================
export const AnimatedBackground: React.FC = () => {
  return (
    <div className="osys-bg">
      <div className="osys-orb osys-orb-1" />
      <div className="osys-orb osys-orb-2" />
      <div className="osys-orb osys-orb-3" />
    </div>
  );
};

// ============================================
// GLASS CARD COMPONENT
// ============================================
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  glow = false,
  onClick,
  style 
}) => {
  return (
    <div 
      className={`osys-card ${glow ? 'osys-card-glow' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
};

// ============================================
// GLASS PANEL (more subtle)
// ============================================
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '' }) => {
  return (
    <div className={`osys-glass ${className}`}>
      {children}
    </div>
  );
};

// ============================================
// PREMIUM BUTTONS
// ============================================
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'gold' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  onClick,
  disabled = false,
  type = 'button',
  style
}) => {
  const variantClass = {
    primary: 'osys-btn-primary',
    gold: 'osys-btn-gold',
    ghost: 'osys-btn-ghost'
  }[variant];

  const sizeClass = {
    sm: 'osys-btn-sm',
    md: '',
    lg: 'osys-btn-lg'
  }[size];

  return (
    <button
      type={type}
      className={`osys-btn ${variantClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
};

// ============================================
// BADGES
// ============================================
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'gold' | 'success' | 'live' | 'coming' | 'warning' | 'error';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = ''
}) => {
  const variantClass = {
    default: '',
    primary: 'osys-badge-primary',
    gold: 'osys-badge-gold',
    success: 'osys-badge-success',
    live: 'osys-badge-live',
    coming: 'osys-badge-coming',
    warning: 'osys-badge-warning',
    error: 'osys-badge-error'
  }[variant];

  return (
    <span className={`osys-badge ${variantClass} ${className}`}>
      {children}
    </span>
  );
};

// ============================================
// GRADIENT TEXT
// ============================================
interface GradientTextProps {
  children: React.ReactNode;
  variant?: 'primary' | 'gold';
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
  className?: string;
}

export const GradientText: React.FC<GradientTextProps> = ({
  children,
  variant = 'primary',
  as: Component = 'span',
  className = ''
}) => {
  const variantClass = variant === 'gold' ? 'osys-text-gradient-gold' : 'osys-text-gradient';
  
  return (
    <Component className={`${variantClass} ${className}`}>
      {children}
    </Component>
  );
};

// ============================================
// PROGRESS BAR
// ============================================
interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  label?: string;
  variant?: 'primary' | 'gold' | 'success';
  className?: string;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  variant = 'primary',
  className = '',
  showLabel = false
}) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const fillClass = {
    primary: '',
    gold: 'osys-progress-fill-gold',
    success: 'osys-progress-fill-success'
  }[variant];

  return (
    <div className={className}>
      {(showLabel || label) && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-400">{label || 'Progress'}</span>
          <span className="text-white font-semibold">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="osys-progress">
        <div 
          className={`osys-progress-fill ${fillClass}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
};

// ============================================
// STAT CARD
// ============================================
interface StatCardProps {
  value: string | number;
  label: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  className = ''
}) => {
  return (
    <div className={`osys-stat ${className}`}>
      <div className="osys-stat-value">{value}</div>
      <div className="osys-stat-label">{label}</div>
    </div>
  );
};

// ============================================
// AVATAR
// ============================================
interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = ''
}) => {
  const sizeClass = `osys-avatar-${size}`;
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={`osys-avatar ${sizeClass} ${className}`}>
      {src ? (
        <img src={src} alt={name || 'Avatar'} />
      ) : (
        <span>{initials || '?'}</span>
      )}
    </div>
  );
};

// ============================================
// INPUT
// ============================================
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input: React.FC<InputProps> = ({
  className = '',
  ...props
}) => {
  return (
    <input
      className={`osys-input ${className}`}
      {...props}
    />
  );
};

// ============================================
// COMING SOON WRAPPER
// ============================================
interface ComingSoonProps {
  children: React.ReactNode;
  label?: string;
  overlay?: boolean;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({
  children,
  label = 'Coming Soon',
  overlay = false
}) => {
  if (overlay) {
    return (
      <div className="osys-coming-soon-overlay">
        {children}
      </div>
    );
  }

  return (
    <div className="osys-coming-soon">
      {children}
    </div>
  );
};

// ============================================
// SECTION HEADER
// ============================================
interface SectionHeaderProps {
  badge?: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  badge,
  title,
  highlight,
  subtitle,
  className = ''
}) => {
  return (
    <div className={`text-center mb-12 ${className}`}>
      {badge && (
        <Badge variant="primary" className="mb-4">
          {badge}
        </Badge>
      )}
      <h2 className="osys-text-display text-zinc-900 dark:text-white">
        {title}
        {highlight && (
          <>
            <br />
            <GradientText>{highlight}</GradientText>
          </>
        )}
      </h2>
      {subtitle && (
        <p className="text-lg text-zinc-600 dark:text-slate-400 mt-4">{subtitle}</p>
      )}
    </div>
  );
};

// ============================================
// HERO STAT
// ============================================
interface HeroStatProps {
  value: string;
  label: string;
}

export const HeroStat: React.FC<HeroStatProps> = ({ value, label }) => {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
    </div>
  );
};

// ============================================
// FEATURE CARD
// ============================================
interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  link?: string;
  comingSoon?: boolean;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  link,
  comingSoon = false
}) => {
  const card = (
    <GlassCard glow className={comingSoon ? 'osys-coming-soon' : ''}>
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm mb-4">{description}</p>
      {link && !comingSoon && (
        <span className="text-purple-400 text-sm font-medium">
          Explore →
        </span>
      )}
    </GlassCard>
  );

  if (link && !comingSoon) {
    return <a href={link} className="block">{card}</a>;
  }

  return card;
};

export default {
  AnimatedBackground,
  GlassCard,
  GlassPanel,
  Button,
  Badge,
  GradientText,
  ProgressBar,
  StatCard,
  Avatar,
  Input,
  ComingSoon,
  SectionHeader,
  HeroStat,
  FeatureCard
};
