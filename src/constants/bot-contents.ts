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
    STRATEGIES: 'Strategies',
    FREE_BOTS: 'Free Bots', // Added Free Bots tab
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    CHART: 2,
    TUTORIAL: 3,
    ANALYSIS: 4,
    STRATEGIES: 5,
    FREE_BOTS: 6, // Added Free Bots tab with index 6
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard', 
    'id-bot-builder', 
    'id-charts', 
    'id-tutorials',
    'id-analysis',
    'id-strategies',
    'id-free-bots', // Added Free Bots tab ID
];

export const DEBOUNCE_INTERVAL_TIME = 500;
