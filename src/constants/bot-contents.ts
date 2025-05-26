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
  STRATEGIES: "Strategies", // Keep existing Strategies tab
  FREE_BOTS: "Free Bots", // Add FreeBots tab
  COPY_TRADING: "Copy Trading", // Add Copy Trading tab
})

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
  DASHBOARD: 0,
  BOT_BUILDER: 1,
  CHART: 2,
  TUTORIAL: 3,
  ANALYSIS: 4,
  STRATEGIES: 5, // Keep existing Strategies tab with index 5
  FREE_BOTS: 6, // Add FreeBots tab with index 6
  COPY_TRADING: 7, // Add Copy Trading tab with index 7
})

export const MAX_STRATEGIES = 10 // Keep this export - it's used by save-modal-store.ts

export const TAB_IDS = [
  "id-dbot-dashboard",
  "id-bot-builder",
  "id-charts",
  "id-tutorials",
  "id-analysis",
  "id-strategies", // Keep existing Strategies tab ID
  "id-free-bots", // Add FreeBots tab ID
  "id-copy-trading", // Add Copy Trading tab ID
]

export const DEBOUNCE_INTERVAL_TIME = 500 // Keep this export - it's used by search-input
