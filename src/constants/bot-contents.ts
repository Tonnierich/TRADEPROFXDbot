// src/constants/bot-contents.ts
type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
    ANALYSIS: 'Analysis',
    STRATEGIES: 'Strategies', // Added Strategies tab
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    TUTORIAL: 3,
    ANALYSIS: 4,
    STRATEGIES: 5, // Added Strategies tab with index 5
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard', 
    'id-bot-builder', 
    'id-charts', 
    'id-tutorials',
    'id-analysis',
    'id-strategies', // Added Strategies tab ID
];

export const DEBOUNCE_INTERVAL_TIME = 500;