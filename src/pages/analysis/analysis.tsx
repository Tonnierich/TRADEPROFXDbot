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
      // Set the active tab to CHART to ensure the run panel is initialized correctly
      // This matches what's done in main.tsx for the Analysis tab
      dashboard.setActiveTab("CHART")

      // Make sure the run panel is visible by toggling the drawer open
      // This is the same approach used in main.tsx
      if (!run_panel.is_drawer_open && typeof run_panel.toggleDrawer === "function") {
        run_panel.toggleDrawer(true)
      }

      // Make sure the run panel wrapper is visible
      const runPanelElement = document.querySelector(".main__run-strategy-wrapper")
      if (runPanelElement) {
        runPanelElement.classList.remove("hidden")
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

