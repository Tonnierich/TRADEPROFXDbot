"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useStore } from "@/hooks/useStore"
import { FREE_BOTS_DATA, type BotData } from "../../data/free-bots-data"

console.log("FREE_BOTS_DATA loaded:", FREE_BOTS_DATA.length, "bots")
console.log(
  "First few bots:",
  FREE_BOTS_DATA.slice(0, 3).map((bot) => bot.name),
)

// Declare Blockly for TypeScript
declare var Blockly: any

const FreeBots: React.FC = () => {
  const store = useStore()
  const [loadingBotId, setLoadingBotId] = useState<string | null>(null)

  const displayedBots = useMemo(() => FREE_BOTS_DATA, [])

  const handleLoadBot = async (bot: BotData) => {
    setLoadingBotId(bot.id)

    try {
      console.log(`🚀 Loading bot: ${bot.name}`)
      const fetchUrl = `/bots/${bot.xmlFileName}`
      console.log(`Fetching XML from: ${fetchUrl}`) // This will show the exact URL

      // Switch to Bot Builder tab first
      if (store?.dashboard?.setActiveTab) {
        store.dashboard.setActiveTab(1)
      }

      // Wait for Blockly to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Fetch the XML file
      const response = await fetch(fetchUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${bot.xmlFileName}: ${response.status} ${response.statusText}`)
      }

      const xmlContent = await response.text()

      // Get workspace
      const workspace = Blockly.getMainWorkspace?.() || Blockly.derivWorkspace
      if (!workspace) {
        throw new Error("Blockly workspace not available")
      }

      // Clear and load
      workspace.clear()
      const xmlDom = Blockly.utils.xml.textToDom(xmlContent)
      Blockly.Xml.domToWorkspace(xmlDom, workspace)

      // Show success notification
      if (store?.ui?.addNotificationMessage) {
        store.ui.addNotificationMessage({
          message: `${bot.name} loaded successfully!`,
          type: "success",
        })
      }

      alert(`✅ ${bot.name} loaded successfully!`)
    } catch (error) {
      console.error(`❌ Failed to load ${bot.name}:`, error)
      alert(`❌ Failed to load ${bot.name}: ${error.message}`)
    } finally {
      setLoadingBotId(null)
    }
  }

  const handleDownloadBot = async (bot: BotData) => {
    try {
      const response = await fetch(`/bots/${bot.xmlFileName}`)
      const xmlContent = await response.text()

      const blob = new Blob([xmlContent], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = bot.xmlFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download bot:", error)
      alert("Failed to download bot.")
    }
  }

  return (
    <div style={{ padding: "2rem", height: "100%", overflow: "auto", backgroundColor: "var(--general-main-1)" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "2.4rem",
            fontWeight: "bold",
            margin: "0 0 1rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            color: "var(--text-prominent)",
          }}
        >
          🤖 Free Trading Bots
        </h1>
        <p style={{ color: "var(--text-less-prominent)", margin: "0", fontSize: "1.4rem", lineHeight: "1.5" }}>
          Discover and use {FREE_BOTS_DATA.length}+ pre-built trading bots created by the community. Load them directly
          into your bot builder.
        </p>
      </div>

      {/* Results Info */}
      <div style={{ marginBottom: "1.6rem", color: "var(--text-less-prominent)", fontSize: "1.2rem" }}>
        Showing {displayedBots.length} bot{displayedBots.length !== 1 ? "s" : ""}
      </div>

      {/* Bots Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {displayedBots.map((bot) => (
          <BotCard key={bot.id} bot={bot} isLoading={loadingBotId === bot.id} onLoad={() => handleLoadBot(bot)} />
        ))}
      </div>

      {/* Empty State */}
      {displayedBots.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem",
            color: "var(--text-less-prominent)",
          }}
        >
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔍</div>
          <h3 style={{ fontSize: "1.8rem", marginBottom: "0.8rem" }}>No bots found</h3>
          <p>Try adjusting your search or filter criteria.</p>
        </div>
      )}
    </div>
  )
}

// Bot Card Component - Simplified Version
const BotCard: React.FC<{
  bot: BotData
  isLoading: boolean
  onLoad: () => void
}> = ({ bot, isLoading, onLoad }) => {
  return (
    <div
      style={{
        backgroundColor: "var(--general-main-1)",
        border: "1px solid var(--general-section-3)",
        borderRadius: "0.6rem",
        padding: "1rem",
        transition: "all 0.2s ease",
        height: "fit-content",
        position: "relative",
        maxHeight: "150px", // Adjusted height for simpler card
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)"
        e.currentTarget.style.transform = "translateY(-1px)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none"
        e.currentTarget.style.transform = "translateY(0)"
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "0.8rem" }}>
        <h3
          style={{
            fontSize: "1.2rem",
            fontWeight: "bold",
            color: "var(--text-prominent)",
            margin: "0",
            lineHeight: "1.2",
          }}
        >
          {bot.name}
        </h3>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.6rem", marginTop: "auto" }}>
        <button
          onClick={onLoad}
          disabled={isLoading}
          style={{
            flex: "1",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.3rem",
            padding: "0.6rem 1rem",
            backgroundColor: isLoading ? "var(--general-section-2)" : "var(--purchase-main-1)",
            color: "white",
            border: "none",
            borderRadius: "0.3rem",
            fontSize: "1rem",
            fontWeight: "600",
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
            transition: "all 0.2s ease",
          }}
        >
          {isLoading ? "⏳" : "▶️"} {isLoading ? "Loading..." : "Load"}
        </button>
      </div>
    </div>
  )
}

export default FreeBots
