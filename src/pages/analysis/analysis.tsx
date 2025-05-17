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

  // Get the toggleDrawer function from the run_panel store
  const { toggleDrawer, is_drawer_open } = run_panel

  // Get the active_tab and set_active_tab from dashboard store
  const { active_tab, setActiveTab } = dashboard

  const toggleTool = () => {
    setShowTool(!showTool)

    // When toggling the tool, ensure the run panel is visible when the tool is shown
    if (!showTool && isDesktop) {
      toggleDrawer(true)
    }
  }

  // When the component mounts or when showTool changes,
  // update the active tab in the dashboard store to enable the run panel
  useEffect(() => {
    if (showTool) {
      // Set the active tab to CHART or another value that enables the run panel
      // This should match one of the values in DBOT_TABS that shows the run panel
      setActiveTab("CHART")
    }
  }, [showTool, setActiveTab])

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
        <div className="analysis-tools__centered-container">
          <div className="analysis-tools__iframe-wrapper">
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

