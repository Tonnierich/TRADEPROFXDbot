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
    if (isDesktop) {
      // Important: Set the active tab to BOT_BUILDER to ensure the run panel is initialized correctly
      dashboard.setActiveTab("BOT_BUILDER")

      // Force the run panel to be visible
      if (!run_panel.is_drawer_open) {
        run_panel.toggleDrawer(true)
      }

      // Add a class to the body to help with styling
      document.body.classList.add("dbot-analysis-active")

      // Make sure the run panel wrapper is visible
      const runPanelElement = document.querySelector(".main__run-strategy-wrapper")
      if (runPanelElement) {
        runPanelElement.classList.remove("hidden")
      }

      // Debug logging to help diagnose the issue
      console.log("Analysis component mounted, checking for run panel elements...")

      // Function to check and style run panel elements
      const styleRunPanelElements = () => {
        // Check for the run panel container
        const runPanelContainer = document.querySelector(".run-panel__container")
        if (runPanelContainer) {
          console.log("Run panel container found, applying styles")
          runPanelContainer.setAttribute(
            "style",
            "display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; z-index: 998 !important; position: fixed !important; top: 104px !important; right: 0 !important; width: 366px !important; height: calc(100vh - 104px) !important;",
          )
        } else {
          console.log("Run panel container NOT found")
        }

        // Check for the run panel toggle
        const toggle = document.querySelector(".run-panel__toggle")
        if (toggle) {
          console.log("Run panel toggle found, applying styles")
          toggle.setAttribute(
            "style",
            "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; left: -24px !important; top: 50% !important; transform: translateY(-50%) !important; z-index: 999 !important;",
          )
        } else {
          console.log("Run panel toggle NOT found")
        }
      }

      // Try styling immediately and after delays
      styleRunPanelElements()
      setTimeout(styleRunPanelElements, 500)
      setTimeout(styleRunPanelElements, 1000)
      setTimeout(styleRunPanelElements, 2000)

      // Create a MutationObserver to watch for the run panel elements
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            // Check if any run panel elements were added
            const hasRunPanelElements = Array.from(mutation.addedNodes).some((node) => {
              if (node instanceof HTMLElement) {
                return (
                  node.classList?.contains("run-panel__container") ||
                  node.classList?.contains("run-panel__toggle") ||
                  node.querySelector(".run-panel__container") ||
                  node.querySelector(".run-panel__toggle")
                )
              }
              return false
            })

            if (hasRunPanelElements) {
              console.log("Run panel elements detected in DOM changes")
              styleRunPanelElements()
            }
          }
        }
      })

      // Start observing the document body for changes
      observer.observe(document.body, { childList: true, subtree: true })

      return () => {
        document.body.classList.remove("dbot-analysis-active")
        observer.disconnect()
      }
    }
  }, [dashboard, run_panel, isDesktop])

  const toggleTool = () => {
    setShowTool(!showTool)
  }

  return (
    <div className={`analysis-tools ${showTool ? "analysis-tools--with-panel" : ""}`} ref={containerRef}>
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
