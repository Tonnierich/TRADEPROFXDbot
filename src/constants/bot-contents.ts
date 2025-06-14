type TTabsTitle = {
  [key: string]: string | number
}

type TDashboardTabIndex = {
  [key: string]: number
}

export const tabs_title: TTabsTitle = Object.freeze({
  WORKSPACE: "Workspace",
  CHART: "Chart",
  ANALYSIS: "Analysis",
  STRATEGIES: "Strategies",
  FREE_BOTS: "Free Bots",
  AI_TRADING_BOTS: "AI Trading Bots", // Added AI Trading Bots tab
})

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
  DASHBOARD: 0,
  BOT_BUILDER: 1,
  CHART: 2,
  TUTORIAL: 3,
  ANALYSIS: 4,
  STRATEGIES: 5,
  FREE_BOTS: 6,
  AI_TRADING_BOTS: 7, // Added AI Trading Bots tab with index 7
})

export const MAX_STRATEGIES = 10

export const TAB_IDS = [
  "id-dbot-dashboard",
  "id-bot-builder",
  "id-charts",
  "id-tutorials",
  "id-analysis",
  "id-strategies",
  "id-free-bots",
  "id-ai-trading-bots", // Added AI Trading Bots tab ID
]

export const DEBOUNCE_INTERVAL_TIME = 500
