"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { useStore } from "@/hooks/useStore"
import { FREE_BOTS_DATA, CATEGORIES, DIFFICULTY_COLORS, type BotData } from "../../data/free-bots-data"

console.log("FREE_BOTS_DATA loaded:", FREE_BOTS_DATA.length, "bots")
console.log(
  "First few bots:",
  FREE_BOTS_DATA.slice(0, 3).map((bot) => bot.name),
)

// Declare Blockly for TypeScript
declare var Blockly: any

const FreeBots: React.FC = () => {
  const store = useStore()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState<"rating" | "downloads" | "name" | "date">("rating")
  const [loadingBotId, setLoadingBotId] = useState<string | null>(null)

  // Filter and sort bots
  const filteredBots = useMemo(() => {
    let filtered = FREE_BOTS_DATA

    // Filter by category
    if (selectedCategory === "featured") {
      filtered = filtered.filter((bot) => bot.isFeatured)
    } else if (selectedCategory === "popular") {
      filtered = filtered.filter((bot) => bot.isPopular)
    } else if (selectedCategory !== "all") {
      filtered = filtered.filter((bot) => bot.category === selectedCategory)
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (bot) =>
          bot.name.toLowerCase().includes(search) ||
          bot.description.toLowerCase().includes(search) ||
          bot.strategy.toLowerCase().includes(search) ||
          bot.tags.some((tag) => tag.toLowerCase().includes(search)) ||
          bot.author.toLowerCase().includes(search),
      )
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return b.rating - a.rating
        case "downloads":
          return b.downloads - a.downloads
        case "name":
          return a.name.localeCompare(b.name)
        case "date":
          return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [selectedCategory, searchTerm, sortBy])

  const handleLoadBot = async (bot: BotData) => {
    setLoadingBotId(bot.id)

    try {
      console.log(`🚀 Loading bot: ${bot.name}`)

      // Switch to Bot Builder tab first
      if (store?.dashboard?.setActiveTab) {
        store.dashboard.setActiveTab(1)
      }

      // Wait for Blockly to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Fetch the XML file
      const response = await fetch(`/bots/${bot.xmlFileName}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch ${bot.xmlFileName}: ${response.status}`)
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

      {/* Search and Sort Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1.6rem",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search bots..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: "1",
              minWidth: "200px",
              padding: "0.8rem 1.2rem",
              border: "1px solid var(--general-section-3)",
              borderRadius: "0.4rem",
              fontSize: "1.4rem",
              backgroundColor: "var(--general-main-1)",
              color: "var(--text-prominent)",
            }}
          />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: "0.8rem 1.2rem",
              border: "1px solid var(--general-section-3)",
              borderRadius: "0.4rem",
              fontSize: "1.4rem",
              backgroundColor: "var(--general-main-1)",
              color: "var(--text-prominent)",
            }}
          >
            <option value="rating">Sort by Rating</option>
            <option value="downloads">Sort by Downloads</option>
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Date</option>
          </select>
        </div>

        {/* Category Filters */}
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              style={{
                padding: "0.6rem 1.2rem",
                border: "1px solid var(--general-section-3)",
                borderRadius: "2rem",
                backgroundColor: selectedCategory === category.id ? "var(--purchase-main-1)" : "var(--general-main-1)",
                color: selectedCategory === category.id ? "white" : "var(--text-prominent)",
                fontSize: "1.2rem",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              {category.name} ({category.count})
            </button>
          ))}
        </div>
      </div>

      {/* Results Info */}
      <div style={{ marginBottom: "1.6rem", color: "var(--text-less-prominent)", fontSize: "1.2rem" }}>
        Showing {filteredBots.length} bot{filteredBots.length !== 1 ? "s" : ""}
        {searchTerm && ` for "${searchTerm}"`}
      </div>

      {/* Bots Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", // Reduced from 350px to 280px
          gap: "1.5rem", // Reduced gap
          marginBottom: "2rem",
        }}
      >
        {filteredBots.map((bot) => (
          <BotCard
            key={bot.id}
            bot={bot}
            isLoading={loadingBotId === bot.id}
            onLoad={() => handleLoadBot(bot)}
            onDownload={() => handleDownloadBot(bot)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredBots.length === 0 && (
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

// Bot Card Component - Compact Version
const BotCard: React.FC<{
  bot: BotData
  isLoading: boolean
  onLoad: () => void
  onDownload: () => void
}> = ({ bot, isLoading, onLoad, onDownload }) => {
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
        maxHeight: "320px", // Limit card height
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
      {/* Badges */}
      <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", display: "flex", gap: "0.2rem" }}>
        {bot.isFeatured && (
          <span
            style={{
              backgroundColor: "#8b5cf6",
              color: "white",
              padding: "0.1rem 0.4rem",
              borderRadius: "0.8rem",
              fontSize: "0.7rem",
              fontWeight: "600",
            }}
          >
            ⭐
          </span>
        )}
        {bot.isPopular && (
          <span
            style={{
              backgroundColor: "#f59e0b",
              color: "white",
              padding: "0.1rem 0.4rem",
              borderRadius: "0.8rem",
              fontSize: "0.7rem",
              fontWeight: "600",
            }}
          >
            🔥
          </span>
        )}
      </div>

      {/* Header */}
      <div style={{ marginBottom: "0.8rem", marginTop: bot.isFeatured || bot.isPopular ? "1.2rem" : "0" }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}
        >
          <h3
            style={{
              fontSize: "1.2rem",
              fontWeight: "bold",
              color: "var(--text-prominent)",
              margin: "0",
              lineHeight: "1.2",
              maxWidth: "70%",
            }}
          >
            {bot.name}
          </h3>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.2rem",
              color: "var(--text-less-prominent)",
              fontSize: "0.9rem",
            }}
          >
            ⭐ {bot.rating}
          </div>
        </div>
        <p
          style={{
            color: "var(--text-less-prominent)",
            fontSize: "1rem",
            lineHeight: "1.3",
            margin: "0",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {bot.description}
        </p>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.8rem" }}>
        <span
          style={{
            backgroundColor: DIFFICULTY_COLORS[bot.difficulty],
            color: "white",
            padding: "0.1rem 0.4rem",
            borderRadius: "0.8rem",
            fontSize: "0.7rem",
            fontWeight: "600",
          }}
        >
          {bot.difficulty}
        </span>
        {bot.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            style={{
              backgroundColor: "var(--general-section-1)",
              color: "var(--text-prominent)",
              padding: "0.1rem 0.4rem",
              borderRadius: "0.8rem",
              fontSize: "0.7rem",
              fontWeight: "500",
            }}
          >
            {tag}
          </span>
        ))}
        {bot.tags.length > 2 && (
          <span
            style={{
              backgroundColor: "var(--general-section-2)",
              color: "var(--text-less-prominent)",
              padding: "0.1rem 0.4rem",
              borderRadius: "0.8rem",
              fontSize: "0.7rem",
              fontWeight: "500",
            }}
          >
            +{bot.tags.length - 2}
          </span>
        )}
      </div>

      {/* Details */}
      <div style={{ marginBottom: "0.8rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "0.9rem" }}>
          <span style={{ color: "var(--text-less-prominent)" }}>Strategy:</span>
          <strong style={{ color: "var(--text-prominent)", fontWeight: "600" }}>{bot.strategy}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "0.9rem" }}>
          <span style={{ color: "var(--text-less-prominent)" }}>Market:</span>
          <strong style={{ color: "var(--text-prominent)", fontWeight: "600" }}>
            {bot.market.length > 15 ? bot.market.substring(0, 15) + "..." : bot.market}
          </strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "0.9rem" }}>
          <span style={{ color: "var(--text-less-prominent)" }}>Stake:</span>
          <strong style={{ color: "var(--text-prominent)", fontWeight: "600" }}>${bot.initialStake}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
          <span style={{ color: "var(--text-less-prominent)" }}>Target:</span>
          <strong style={{ color: "var(--purchase-main-1)", fontWeight: "600" }}>${bot.profitThreshold}</strong>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          gap: "0.8rem",
          marginBottom: "1rem",
          paddingTop: "0.6rem",
          borderTop: "1px solid var(--general-section-2)",
          fontSize: "0.8rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", color: "var(--text-less-prominent)" }}>
          📥 {bot.downloads > 999 ? `${(bot.downloads / 1000).toFixed(1)}k` : bot.downloads}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", color: "var(--text-less-prominent)" }}>
          👤 {bot.author}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.6rem" }}>
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
        <button
          onClick={onDownload}
          style={{
            width: "2.8rem",
            height: "2.8rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--general-section-1)",
            color: "var(--text-prominent)",
            border: "1px solid var(--general-section-3)",
            borderRadius: "0.3rem",
            cursor: "pointer",
            transition: "all 0.2s ease",
            fontSize: "0.9rem",
          }}
        >
          📥
        </button>
      </div>
    </div>
  )
}

export default FreeBots
