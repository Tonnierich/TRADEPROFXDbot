"use client"

import type React from "react"
import { useState } from "react"
import { useStore } from "@/hooks/useStore"

// Declare Blockly for TypeScript
declare var Blockly: any

const FreeBots: React.FC = () => {
  const store = useStore()
  const [isLoading, setIsLoading] = useState(false)

  const handleLoadBot = async () => {
    setIsLoading(true)

    try {
      console.log("🚀 Starting bot load process...")

      // First, switch to Bot Builder tab to ensure Blockly is initialized
      console.log("🔄 Switching to Bot Builder tab first...")
      if (store?.dashboard?.setActiveTab) {
        store.dashboard.setActiveTab(1) // Bot Builder tab
        console.log("✅ Switched to Bot Builder tab")
      } else {
        throw new Error("Dashboard not available")
      }

      // Wait a moment for the tab to load and Blockly to initialize
      console.log("⏳ Waiting for Blockly to initialize...")
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Fetch the XML file
      console.log("📥 Fetching XML file...")
      const response = await fetch("/bots/medaleone-bot.xml")

      if (!response.ok) {
        throw new Error(`Failed to fetch XML: ${response.status}`)
      }

      const xmlContent = await response.text()
      console.log("✅ XML content loaded:", xmlContent.substring(0, 100) + "...")

      // Check if Blockly is available globally
      if (typeof Blockly === "undefined") {
        throw new Error("Blockly not loaded globally. Please make sure you're on the Bot Builder tab.")
      }
      console.log("✅ Blockly globally available")

      // Try to get workspace from different possible locations
      let workspace = null

      // Method 1: From store
      if (store?.blockly_store?.workspace) {
        workspace = store.blockly_store.workspace
        console.log("✅ Got workspace from store.blockly_store")
      }
      // Method 2: From Blockly global
      else if (Blockly.getMainWorkspace && Blockly.getMainWorkspace()) {
        workspace = Blockly.getMainWorkspace()
        console.log("✅ Got workspace from Blockly.getMainWorkspace()")
      }
      // Method 3: From derivWorkspace
      else if (Blockly.derivWorkspace) {
        workspace = Blockly.derivWorkspace
        console.log("✅ Got workspace from Blockly.derivWorkspace")
      }

      if (!workspace) {
        throw new Error(
          "Blockly workspace not available. Please ensure you're on the Bot Builder tab and Blockly is loaded.",
        )
      }

      // Clear current workspace
      console.log("🧹 Clearing workspace...")
      workspace.clear()

      // Load XML content into Blockly workspace using different methods
      console.log("📋 Parsing and loading XML...")

      try {
        // Method 1: Try modern Blockly utils
        if (Blockly.utils && Blockly.utils.xml && Blockly.utils.xml.textToDom) {
          console.log("🔄 Using Blockly.utils.xml.textToDom...")
          const xmlDom = Blockly.utils.xml.textToDom(xmlContent)
          Blockly.Xml.domToWorkspace(xmlDom, workspace)
          console.log("✅ Loaded using Blockly.utils.xml")
        }
        // Method 2: Try Blockly.Xml (older versions)
        else if (Blockly.Xml && Blockly.Xml.textToDom) {
          console.log("🔄 Using Blockly.Xml.textToDom...")
          const xmlDom = Blockly.Xml.textToDom(xmlContent)
          Blockly.Xml.domToWorkspace(xmlDom, workspace)
          console.log("✅ Loaded using Blockly.Xml")
        }
        // Method 3: Try browser DOMParser
        else {
          console.log("🔄 Using DOMParser fallback...")
          const parser = new DOMParser()
          const xmlDom = parser.parseFromString(xmlContent, "text/xml")

          // Check for parsing errors
          const parseError = xmlDom.querySelector("parsererror")
          if (parseError) {
            throw new Error("XML parsing failed: " + parseError.textContent)
          }

          // Try different domToWorkspace methods
          if (Blockly.Xml && Blockly.Xml.domToWorkspace) {
            Blockly.Xml.domToWorkspace(xmlDom.documentElement, workspace)
          } else if (workspace.loadBlocks) {
            workspace.loadBlocks(xmlContent)
          } else {
            throw new Error("No suitable method to load blocks found")
          }
          console.log("✅ Loaded using DOMParser fallback")
        }
      } catch (xmlError) {
        console.error("XML loading error:", xmlError)
        throw new Error(`Failed to load XML: ${xmlError.message}`)
      }

      console.log("✅ Blocks loaded into workspace successfully!")

      // Show success notification
      console.log("🔔 Showing success notification...")
      if (store?.ui?.addNotificationMessage) {
        store.ui.addNotificationMessage({
          message: "MEDALEONE BOT loaded successfully!",
          type: "success",
        })
        console.log("✅ Success notification shown")
      }

      // Success alert
      alert("✅ MEDALEONE BOT loaded successfully! Check the Bot Builder tab.")
    } catch (error) {
      console.error("❌ Failed to load bot:", error)

      // Show detailed error to user
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      alert(
        `❌ Failed to load bot: ${errorMessage}\n\nTry switching to the Bot Builder tab first, then come back and try again.`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadBot = async () => {
    try {
      const response = await fetch("/bots/medaleone-bot.xml")
      const xmlContent = await response.text()

      const blob = new Blob([xmlContent], { type: "application/xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "medaleone-bot.xml"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to download bot:", error)
      alert("Failed to download bot.")
    }
  }

  const debugBlockly = () => {
    console.log("🔍 Blockly API debug info:")
    console.log("- Blockly:", typeof Blockly !== "undefined")
    console.log("- Blockly.Xml:", !!Blockly?.Xml)
    console.log("- Blockly.Xml.textToDom:", !!Blockly?.Xml?.textToDom)
    console.log("- Blockly.Xml.domToWorkspace:", !!Blockly?.Xml?.domToWorkspace)
    console.log("- Blockly.utils:", !!Blockly?.utils)
    console.log("- Blockly.utils.xml:", !!Blockly?.utils?.xml)
    console.log("- Blockly.utils.xml.textToDom:", !!Blockly?.utils?.xml?.textToDom)
    console.log("- Blockly.getMainWorkspace():", !!Blockly?.getMainWorkspace?.())
    console.log("- Blockly.derivWorkspace:", !!Blockly?.derivWorkspace)

    const workspace = Blockly.getMainWorkspace?.() || Blockly.derivWorkspace
    if (workspace) {
      console.log("- workspace.loadBlocks:", !!workspace.loadBlocks)
      console.log("- workspace.clear:", !!workspace.clear)
      console.log("- current blocks count:", workspace.getAllBlocks?.()?.length || "unknown")
    }
  }

  return (
    <div
      style={{
        padding: "2rem",
        height: "100%",
        backgroundColor: "var(--general-main-1)",
        color: "var(--text-prominent)",
      }}
    >
      <div style={{ marginBottom: "2rem" }}>
        <h2
          style={{
            fontSize: "2.4rem",
            fontWeight: "bold",
            margin: "0 0 1rem 0",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
          }}
        >
          🤖 Free Trading Bots
        </h2>
        <p
          style={{
            color: "var(--text-less-prominent)",
            margin: "0",
            fontSize: "1.4rem",
            lineHeight: "1.5",
          }}
        >
          Discover and use pre-built trading bots created by the community. Load them directly into your bot builder.
        </p>

        {/* Instructions */}
        <div
          style={{
            backgroundColor: "var(--general-section-1)",
            padding: "1rem",
            borderRadius: "0.4rem",
            marginTop: "1rem",
            fontSize: "1.2rem",
          }}
        >
          💡 <strong>Tip:</strong> If loading fails, try switching to the Bot Builder tab first, then come back and
          click Load Bot.
        </div>
      </div>

      {/* MEDALEONE BOT Card */}
      <div
        style={{
          backgroundColor: "var(--general-main-1)",
          border: "1px solid var(--general-section-3)",
          borderRadius: "0.8rem",
          padding: "1.6rem",
          maxWidth: "400px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "1.2rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "0.8rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.6rem",
                fontWeight: "bold",
                color: "var(--text-prominent)",
                margin: "0",
              }}
            >
              MEDALEONE BOT
            </h3>
            <span style={{ color: "var(--text-less-prominent)", fontSize: "1.2rem" }}>⭐ 4.8</span>
          </div>
          <p
            style={{
              color: "var(--text-less-prominent)",
              fontSize: "1.3rem",
              lineHeight: "1.4",
              margin: "0",
            }}
          >
            Advanced Martingale strategy bot for synthetic indices with intelligent stake management.
          </p>
        </div>

        <div style={{ marginBottom: "1.6rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span>Strategy:</span>
            <strong>Martingale</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span>Market:</span>
            <strong>R_10</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span>Initial Stake:</span>
            <strong>$5</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Profit Target:</span>
            <strong style={{ color: "var(--purchase-main-1)" }}>$15</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.8rem" }}>
          <button
            onClick={handleLoadBot}
            disabled={isLoading}
            style={{
              flex: "1",
              padding: "0.8rem 1.6rem",
              backgroundColor: isLoading ? "var(--general-section-2)" : "var(--purchase-main-1)",
              color: "white",
              border: "none",
              borderRadius: "0.4rem",
              fontSize: "1.2rem",
              fontWeight: "600",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "⏳ Loading..." : "▶️ Load Bot"}
          </button>
          <button
            onClick={debugBlockly}
            style={{
              padding: "0.4rem 0.8rem",
              backgroundColor: "var(--general-section-2)",
              color: "var(--text-prominent)",
              border: "1px solid var(--general-section-3)",
              borderRadius: "0.4rem",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            🔍 Debug
          </button>
          <button
            onClick={handleDownloadBot}
            style={{
              width: "3.2rem",
              height: "3.2rem",
              backgroundColor: "var(--general-section-1)",
              color: "var(--text-prominent)",
              border: "1px solid var(--general-section-3)",
              borderRadius: "0.4rem",
              cursor: "pointer",
            }}
          >
            📥
          </button>
        </div>
      </div>
    </div>
  )
}

export default FreeBots
