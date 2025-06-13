
export interface BotData {
  id: string
  name: string
}

export const FREE_BOTS_DATA: BotData[] = [
  {
    id: "percentage-even-odd-bot",
    name: "Percentage Even Odd Bot",
  },
  {
    id: "under-8-tradepro",
    name: "Under 8 by TradePro",
  },
  {
    id: "tradeprofx-accumulators",
    name: "TradeProfx Accumulators",
  },
  {
    id: "dp-entry-point-bot",
    name: "DP Entry Point Bot V1",
  },
  {
    id: "rise-fall-dbot",
    name: "Rise Fall DBot",
  },
  {
    id: "auto-c4-volt-2",
    name: "AUTO C4 ⚡VOLT 2",
  },
  {
    id: "simple-martingale",
    name: "Simple Martingale",
  },
  {
    id: "trend-rider",
    name: "Trend Rider",
  },
  {
    id: "safe-trader",
    name: "Safe Trader",
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
