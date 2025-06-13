export interface BotData {
  id: string
  name: string
  category: string
  isPopular?: boolean
  isFeatured?: boolean
}

export const FREE_BOTS_DATA: BotData[] = [
  {
    id: "percentage-even-odd-bot",
    name: "Percentage Even Odd Bot",
    category: "digits",
    isPopular: true,
    isFeatured: true,
  },
  {
    id: "under-8-tradepro",
    name: "Under 8 by TradePro",
    category: "digits",
    isPopular: true,
    isFeatured: true,
  },
  {
    id: "tradeprofx-accumulators",
    name: "TradeProfx Accumulators",
    category: "accumulator",
    isFeatured: true,
  },
  {
    id: "dp-entry-point-bot",
    name: "DP Entry Point Bot V1",
    category: "callput",
    isPopular: true,
  },
  {
    id: "rise-fall-dbot",
    name: "Rise Fall DBot",
    category: "digits",
  },
  {
    id: "auto-c4-volt-2",
    name: "AUTO C4 ⚡VOLT 2",
    category: "callput",
    isPopular: true,
    isFeatured: true,
  },
  {
    id: "simple-martingale",
    name: "Simple Martingale",
    category: "martingale",
  },
  {
    id: "trend-rider",
    name: "Trend Rider",
    category: "trend",
  },
  {
    id: "safe-trader",
    name: "Safe Trader",
    category: "conservative",
    isPopular: true,
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
