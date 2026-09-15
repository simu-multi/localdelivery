import { PIcon } from '@porsche-design-system/components-react';

interface BottomNavItem {
  icon: string;
  label: string;
  tab: string;
}

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  items: BottomNavItem[];
}

export default function BottomNav({ activeTab, onTabChange, items }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-contrast-low"
      style={{ boxShadow: '0px -4px 16px rgba(0,0,0,.08)' }}
    >
      <div className="flex items-stretch max-w-lg mx-auto">
        {items.map((item) => {
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onTabChange(item.tab)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                isActive ? 'text-[#006FFF]' : 'text-contrast-medium'
              }`}
            >
              <PIcon name={item.icon as any} size="medium" color={isActive ? 'inherit' : 'contrast-medium'} />
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-[#006FFF]' : 'text-contrast-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
