"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useState, useEffect } from "react"
import { useStore } from "@/hooks/useStore"
import "./analysis.scss"

const Analysis = observer(() => {
  const { isDesktop } = useDevice()
  const { run_panel, dashboard } = useStore()
  const [showTool, setShowTool] = useState(true)

  // Initialize the run panel when the component mounts
  useEffect(() => {
    if (showTool && isDesktop) {
      // Set the active tab to BOT_BUILDER to enable the run panel
      dashboard.setActiveTab("BOT_BUILDER")
      
      // Make sure the run panel is visible
      if (!run_panel.is_drawer_open) {
        run_panel.toggleDrawer(true)
      }
      
      // Add a class to the body to help with styling
      document.body.classList.add("dbot-analysis-active")
    } else {
      document.body.classList.remove("dbot-analysis-active")
    }

    return () => {
      document.body.classList.remove("dbot-analysis-active")
    }
  }, [showTool, dashboard, run_panel, isDesktop])

  const toggleTool = () => {
    setShowTool(!showTool)
  }

  return (
    <div className="analysis-tools">
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
          
          {/* We don't need to include the RunPanel directly, 
              the app will handle it through the store interactions */}
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
