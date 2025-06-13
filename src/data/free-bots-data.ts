export interface BotData {
  id: string
  name: string
  description: string
  strategy: string
  market: string
  profitThreshold: number
  lossThreshold: number
  initialStake: number
  rating: number
  downloads: number
  xmlFileName: string // Just the filename, we'll add path automatically
  tags: string[]
  author: string
  createdDate: string
  category: string
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  isPopular?: boolean
  isFeatured?: boolean
}

export const FREE_BOTS_DATA: BotData[] = [
  // Real Trading Bots from XML files
  {
    id: "percentage-even-odd-bot",
    name: "Percentage Even Odd Bot",
    xmlFileName: "percentage-even-odd-bot.xml",
    tags: ["Even/Odd", "Digits", "Analysis", "Percentage", "Auto-Trade"],
  },
  {
    id: "under-8-tradepro",
    name: "Under 8 by TradePro",
    xmlFileName: "under-8-tradepro.xml",
    tags: ["Under/Over", "Martingale", "Professional", "Compound", "Risk Management"],
  },
  {
    id: "tradeprofx-accumulators",
    name: "TradeProfx Accumulators",
    description:
    xmlFileName: "tradeprofx-accumulators.xml",
    tags: ["Accumulator", "Martingale", "Growth Rate", "Tick Analysis"],
  },
  {
    id: "dp-entry-point-bot",
    name: "DP Entry Point Bot V1",
    xmlFileName: "dp-entry-point-bot.xml",
    tags: ["Call/Put", "Entry Point", "Simple", "Beginner-Friendly"],
  },
  {
    id: "rise-fall-dbot",
    name: "Rise Fall DBot",
    xmlFileName: "rise-fall-dbot.xml",
    tags: ["Rise/Fall", "Adaptive", "Profit Target", "Dynamic"],
  },
  {
    id: "auto-c4-volt-2",
    name: "AUTO C4 ⚡VOLT 2",
    xmlFileName: "auto-c4-volt-2.xml",
    tags: ["Higher/Lower", "Automated", "Martingale", "High Performance", "Notifications"],
    author: "C4 Trading",
    createdDate: "2024-02-15",
    category: "callput",
    difficulty: "Advanced",
    isPopular: true,
    isFeatured: true,
  },

  // Additional Sample Bots (you can remove these later)
  {
    id: "simple-martingale",
    name: "Simple Martingale",
    xmlFileName: "simple-martingale.xml",
    tags: ["Martingale", "Beginner", "Simple"],
  },
  {
    id: "trend-rider",
    name: "Trend Rider",
    xmlFileName: "trend-rider.xml",
    tags: ["Trend Following", "Moving Average", "Momentum"],
  },
  {
    id: "safe-trader",
    name: "Safe Trader",
    xmlFileName: "safe-trader.xml",
  },
]

export const CATEGORIES = [
  { id: "all", name: "All Bots", count: FREE_BOTS_DATA.length },
  { id: "featured", name: "Featured", count: FREE_BOTS_DATA.filter((bot) => bot.isFeatured).length },
  { id: "popular", name: "Popular", count: FREE_BOTS_DATA.filter((bot) => bot.isPopular).length },
  { id: "digits", name: "Digits Trading", count: FREE_BOTS_DATA.filter((bot) => bot.category === "digits").length },
  { id: "callput", name: "Call/Put", count: FREE_BOTS_DATA.filter((bot) => bot.category === "callput").length },
  {
    id: "accumulator",
    name: "Accumulator",
    count: FREE_BOTS_DATA.filter((bot) => bot.category === "accumulator").length,
  },
  { id: "martingale", name: "Martingale", count: FREE_BOTS_DATA.filter((bot) => bot.category === "martingale").length },
  { id: "trend", name: "Trend Following", count: FREE_BOTS_DATA.filter((bot) => bot.category === "trend").length },
  {
    id: "conservative",
    name: "Conservative",
    count: FREE_BOTS_DATA.filter((bot) => bot.category === "conservative").length,
  },
]

export const DIFFICULTY_COLORS = {
  Beginner: "#22c55e", // Green
  Intermediate: "#f59e0b", // Orange
  Advanced: "#ef4444", // Red
}

