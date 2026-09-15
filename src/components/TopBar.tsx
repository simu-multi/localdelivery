import { PHeading, PIcon } from '@porsche-design-system/components-react';
import { useAuth } from '../lib/auth';

interface Props {
  title: string;
  onNotificationClick?: () => void;
  unreadCount?: number;
}

export default function TopBar({ title, onNotificationClick, unreadCount = 0 }: Props) {
  const { signOut } = useAuth();

  return (
    <header
      className="sticky top-0 z-40 bg-surface border-b border-contrast-low px-fluid-md py-3 flex items-center justify-between"
      style={{ boxShadow: '0px 4px 16px rgba(0,0,0,.06)' }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#006FFF' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <PHeading size="small" tag="h2">{title}</PHeading>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onNotificationClick}
          className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-canvas transition-colors"
        >
          <PIcon name="bell" size="small" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ background: '#FF3B30' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={signOut}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-canvas transition-colors"
        >
          <PIcon name="logout" size="small" />
        </button>
      </div>
    </header>
  );
}
