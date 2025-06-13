export interface BotData {
  id: string
  name: string
  xmlFileName: string // Essential for loading the bot
}

export const FREE_BOTS_DATA: BotData[] = [
  {
    id: "percentage-even-odd-bot",
    name: "Percentage Even Odd Bot",
    xmlFileName: "percentage-even-odd-bot.xml",
  },
  {
    id: "under-8-tradepro",
    name: "Under 8 by TradePro",
    xmlFileName: "under-8-tradepro.xml",
  },
  {
    id: "tradeprofx-accumulators",
    name: "TradeProfx Accumulators",
    xmlFileName: "tradeprofx-accumulators.xml",
  },
  {
    id: "dp-entry-point-bot",
    name: "DP Entry Point Bot V1",
    xmlFileName: "dp-entry-point-bot.xml",
  },
  {
    id: "rise-fall-dbot",
    name: "Rise Fall DBot",
    xmlFileName: "rise-fall-dbot.xml",
  },
  {
    id: "auto-c4-volt-2",
    name: "AUTO C4 ⚡VOLT 2",
    xmlFileName: "auto-c4-volt-2.xml",
  },
  {
    id: "medaleone-bot", // Added this bot
    name: "Medaleone Bot", // Added this bot
    xmlFileName: "medaleone-bot.xml", // Added this bot
  },
  // Removed "Simple Martingale" and "Trend Rider" as their XML files are not present
]

