"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/hooks/useStore"
import "./analysis.scss"

const Analysis = observer(() => {
  const { isDesktop } = useDevice()
  const { run_panel, dashboard } = useStore()
  const [showTool, setShowTool] = useState(true)
  const containerRef = useRef(null)

  // Initialize the run panel when the component mounts
  useEffect(() => {
    if (showTool && isDesktop) {
      // Set the active tab to BOT_BUILDER to ensure the run panel is initialized correctly
      dashboard.setActiveTab("BOT_BUILDER")

      // Force the run panel to be visible
      if (!run_panel.is_drawer_open) {
        run_panel.toggleDrawer(true)
      }

      // Add a class to the body to help with styling
      document.body.classList.add("dbot-analysis-active")

      // Create a MutationObserver to watch for the run panel toggle
      const observer = new MutationObserver((mutations) => {
        // Check if the run panel toggle exists
        const toggle = document.querySelector(".run-panel__toggle")
        if (toggle) {
          console.log("Found run panel toggle, applying styles")
          // Make sure it's visible
          toggle.setAttribute(
            "style",
            "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; left: -24px !important; top: 50% !important; transform: translateY(-50%) !important; z-index: 20 !important;",
          )
        }
      })

      // Start observing the document body for changes
      observer.observe(document.body, { childList: true, subtree: true })

      // Also try to find and style the toggle button directly after a short delay
      setTimeout(() => {
        const toggle = document.querySelector(".run-panel__toggle")
        if (toggle) {
          console.log("Found run panel toggle after delay, applying styles")
          toggle.setAttribute(
            "style",
            "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; left: -24px !important; top: 50% !important; transform: translateY(-50%) !important; z-index: 20 !important;",
          )
        } else {
          console.log("Run panel toggle not found after delay")
        }
      }, 1000)

      return () => {
        document.body.classList.remove("dbot-analysis-active")
        observer.disconnect()
      }
    }
  }, [showTool, dashboard, run_panel, isDesktop])

  const toggleTool = () => {
    setShowTool(!showTool)
  }

  return (
    <div className="analysis-tools" ref={containerRef}>
      <div className="analysis-tools__compact-header">
        <h2 className="analysis-tools__title">
          <Localize i18n_default_text="Analysis Tools" />
        </h2>
        <button className="analysis-tools__toggle-button" onClick={toggleTool}>
          <Localize i18n_default_text={showTool ? "Hide Tool" : "Show Tool"} />
        </button>
      </div>

      {showTool ? (
        <div className="analysis-tools__content-wrapper">
          <div className="analysis-tools__iframe-container">
            <iframe
              src="https://v0-convert-to-react-eta.vercel.app/"
              className="analysis-tools__iframe"
              title="TRADEPROFX Analysis Tool"
              allow="fullscreen"
              scrolling="no"
            />
          </div>
        </div>
      ) : (
        <div className="analysis-tools__card">
          <div className="analysis-tools__card-header">
            <h4 className="analysis-tools__card-title">
              <Localize i18n_default_text="TRADEPROFX BEST MEDALEONE ANALYSIS TOOL" />
            </h4>
          </div>
          <div className="analysis-tools__card-content">
            <p>
              <Localize i18n_default_text="Click to open our advanced trading analysis tool with real-time market data and powerful indicators." />
            </p>
            <button className="analysis-tools__button" onClick={toggleTool}>
              <Localize i18n_default_text="Show Tool" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

export default Analysis
