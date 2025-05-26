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
    description:
      "Advanced bot that analyzes even/odd digit patterns over the last 20 ticks and trades based on percentage thresholds. Uses intelligent prediction logic with 60% trading threshold.",
    strategy: "Even/Odd Analysis",
    market: "Synthetic Indices (R_10)",
    profitThreshold: 15,
    lossThreshold: 1000000000,
    initialStake: 20,
    rating: 4.7,
    downloads: 892,
    xmlFileName: "percentage-even-odd-bot.xml",
    tags: ["Even/Odd", "Digits", "Analysis", "Percentage", "Auto-Trade"],
    author: "Community",
    createdDate: "2024-01-15",
    category: "digits",
    difficulty: "Advanced",
    isPopular: true,
    isFeatured: true,
  },
  {
    id: "under-8-tradepro",
    name: "Under 8 by TradePro",
    description:
      "Professional under 8 prediction bot with advanced martingale system, compound levels, and comprehensive profit/loss management. Features multiple martingale splits and levels.",
    strategy: "Under/Over Digits",
    market: "Synthetic Indices (R_10)",
    profitThreshold: 100,
    lossThreshold: 100,
    initialStake: 400,
    rating: 4.9,
    downloads: 1456,
    xmlFileName: "under-8-tradepro.xml",
    tags: ["Under/Over", "Martingale", "Professional", "Compound", "Risk Management"],
    author: "TradePro",
    createdDate: "2024-01-20",
    category: "digits",
    difficulty: "Advanced",
    isPopular: true,
    isFeatured: true,
  },
  {
    id: "tradeprofx-accumulators",
    name: "TradeProfx Accumulators",
    description:
      "Sophisticated accumulator trading bot with martingale functionality, profit/loss thresholds, and intelligent stake management. Features tick counting and sell-by-countdown options.",
    strategy: "Accumulator",
    market: "Synthetic Indices (R_10)",
    profitThreshold: 100,
    lossThreshold: 10000,
    initialStake: 4,
    rating: 4.6,
    downloads: 743,
    xmlFileName: "tradeprofx-accumulators.xml",
    tags: ["Accumulator", "Martingale", "Growth Rate", "Tick Analysis"],
    author: "TradeProfx",
    createdDate: "2024-02-01",
    category: "accumulator",
    difficulty: "Advanced",
    isFeatured: true,
  },
  {
    id: "dp-entry-point-bot",
    name: "DP Entry Point Bot V1",
    description:
      "Simple and effective entry point bot for call/put trading. Perfect for beginners looking to understand basic trading mechanics with clean, straightforward logic.",
    strategy: "Call/Put",
    market: "Synthetic Indices (R_100)",
    profitThreshold: 50,
    lossThreshold: 50,
    initialStake: 10,
    rating: 4.2,
    downloads: 567,
    xmlFileName: "dp-entry-point-bot.xml",
    tags: ["Call/Put", "Entry Point", "Simple", "Beginner-Friendly"],
    author: "DP Trading",
    createdDate: "2024-02-05",
    category: "callput",
    difficulty: "Beginner",
    isPopular: true,
  },
  {
    id: "rise-fall-dbot",
    name: "Rise Fall DBot",
    description:
      "Intelligent rise/fall trading bot with dynamic prediction adjustment, profit targeting, and stop-loss management. Features adaptive strategy based on win/loss patterns.",
    strategy: "Rise/Fall",
    market: "Synthetic Indices (R_10)",
    profitThreshold: 5,
    lossThreshold: 1,
    initialStake: 5,
    rating: 4.4,
    downloads: 834,
    xmlFileName: "rise-fall-dbot.xml",
    tags: ["Rise/Fall", "Adaptive", "Profit Target", "Dynamic"],
    author: "Community",
    createdDate: "2024-02-10",
    category: "digits",
    difficulty: "Intermediate",
  },
  {
    id: "auto-c4-volt-2",
    name: "AUTO C4 ⚡VOLT 2",
    description:
      "High-performance automated higher/lower trading bot with martingale system, stop-loss protection, and profit targeting. Features real-time notifications and comprehensive trade management.",
    strategy: "Higher/Lower",
    market: "Synthetic Indices (R_10)",
    profitThreshold: 5,
    lossThreshold: 50,
    initialStake: 1,
    rating: 4.8,
    downloads: 1123,
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
    description:
      "Basic Martingale strategy perfect for beginners. Doubles stake after losses with simple profit targets.",
    strategy: "Martingale",
    market: "Synthetic Indices (R_50)",
    profitThreshold: 10,
    lossThreshold: 100,
    initialStake: 1,
    rating: 4.2,
    downloads: 456,
    xmlFileName: "simple-martingale.xml",
    tags: ["Martingale", "Beginner", "Simple"],
    author: "TradingBot Pro",
    createdDate: "2024-01-20",
    category: "martingale",
    difficulty: "Beginner",
  },
  {
    id: "trend-rider",
    name: "Trend Rider",
    description: "Follows market trends with moving averages and momentum indicators.",
    strategy: "Trend Following",
    market: "Synthetic Indices (R_25)",
    profitThreshold: 20,
    lossThreshold: 30,
    initialStake: 4,
    rating: 4.3,
    downloads: 612,
    xmlFileName: "trend-rider.xml",
    tags: ["Trend Following", "Moving Average", "Momentum"],
    author: "TrendMaster",
    createdDate: "2024-02-10",
    category: "trend",
    difficulty: "Intermediate",
  },
  {
    id: "safe-trader",
    name: "Safe Trader",
    description: "Conservative trading strategy with low risk and steady returns.",
    strategy: "Conservative",
    market: "Synthetic Indices (R_10)",
    profitThreshold: 12,
    lossThreshold: 15,
    initialStake: 2,
    rating: 4.7,
    downloads: 756,
    xmlFileName: "safe-trader.xml",
    tags: ["Conservative", "Low Risk", "Steady"],
    author: "SafeTrading",
    createdDate: "2024-03-01",
    category: "conservative",
    difficulty: "Beginner",
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

