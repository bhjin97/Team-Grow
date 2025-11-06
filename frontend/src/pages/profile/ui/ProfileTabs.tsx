type TabType = 'activity' | 'ingredients';

interface TabItem {
  id: TabType;
  label: string;
}

const tabs: TabItem[] = [
  { id: 'activity', label: '나의 활동' },
  { id: 'ingredients', label: '성분 관리' },
];

export interface ProfileTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const ProfileTabs = ({ activeTab, onTabChange }: ProfileTabsProps) => {
  return (
    <div className="bg-white rounded-t-2xl shadow-lg mb-0">
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-semibold transition-colors ${
              activeTab === tab.id
                ? 'text-pink-600 border-b-2 border-pink-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export type { TabType };
