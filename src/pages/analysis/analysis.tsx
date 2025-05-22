"use client"
import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/hooks/useStore"
import { DBOT_TABS } from "@/constants/bot-contents"
import "./analysis.scss"

// Define the available analysis tools
const ANALYSIS_TOOLS = {
  TRADEPROFX: {
    name: "TRADEPROFX Analysis",
    url: "https://v0-convert-to-react-eta.vercel.app/",
    description: "Advanced trading analysis tool with real-time market data and powerful indicators.",
  },
  EVEN_ODD_RISE_FALL: {
    name: "Even/Odd $Rise Fall",
    url: "https://v0-deriv-analysis-tool-1u.vercel.app/",
    description: "Analyze even/odd patterns and rise/fall predictions for better trading decisions.",
  },
}

const Analysis = observer(() => {
  const { isDesktop, isMobile } = useDevice()
  const { run_panel, dashboard } = useStore()
  const [showTool, setShowTool] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTool, setSelectedTool] = useState("TRADEPROFX")
  const containerRef = useRef(null)
  const iframeRef = useRef(null)

  // Handle iframe loading
  const handleIframeLoad = () => {
    setIsLoading(false)
    console.log(`${ANALYSIS_TOOLS[selectedTool].name} iframe loaded successfully`)
  }

  // Initialize the run panel when the component mounts
  useEffect(() => {
    // Important: Set the active tab to ANALYSIS to ensure the run panel is initialized correctly
    dashboard.setActiveTab(DBOT_TABS.ANALYSIS)

    // Force the run panel to be visible
    if (!run_panel.is_drawer_open) {
      run_panel.toggleDrawer(true)
    }

    // Add a class to the body to help with styling
    document.body.classList.add("dbot-analysis-active")
    if (isMobile) {
      document.body.classList.add("dbot-analysis-mobile")
      document.body.classList.add("dbot-mobile")
    }

    return () => {
      document.body.classList.remove("dbot-analysis-active")
      document.body.classList.remove("dbot-analysis-mobile")
      document.body.classList.remove("dbot-mobile")
    }
  }, [dashboard, run_panel, isDesktop, isMobile, DBOT_TABS.ANALYSIS])

  // Reset loading state when tool changes
  useEffect(() => {
    setIsLoading(true)
  }, [selectedTool])

  const toggleTool = () => {
    setShowTool(!showTool)
  }

  const switchTool = (toolKey) => {
    setSelectedTool(toolKey)
  }

  return (
    <div
      className={`analysis-tools ${showTool ? "analysis-tools--with-panel" : ""} ${isMobile ? "analysis-tools--mobile" : ""}`}
      ref={containerRef}
    >
      <div className="analysis-tools__compact-header">
        <h2 className="analysis-tools__title">
          <Localize i18n_default_text="Analysis Tools" />
        </h2>
        <div className="analysis-tools__header-actions">
          {showTool && (
            <div className="analysis-tools__tool-switcher">
              {Object.keys(ANALYSIS_TOOLS).map((toolKey) => (
                <button
                  key={toolKey}
                  className={`analysis-tools__tool-switch ${selectedTool === toolKey ? "analysis-tools__tool-switch--active" : ""}`}
                  onClick={() => switchTool(toolKey)}
                >
                  <Localize i18n_default_text={ANALYSIS_TOOLS[toolKey].name} />
                </button>
              ))}
            </div>
          )}
          <button className="analysis-tools__toggle-button" onClick={toggleTool}>
            <Localize i18n_default_text={showTool ? "Hide Tool" : "Show Tool"} />
          </button>
        </div>
      </div>

      {showTool ? (
        <div className="analysis-tools__content-wrapper">
          {isLoading && (
            <div className="analysis-tools__loading">
              <div className="analysis-tools__loading-spinner"></div>
              <p>Loading {ANALYSIS_TOOLS[selectedTool].name}...</p>
            </div>
          )}
          <div className="analysis-tools__iframe-container">
            <iframe
              ref={iframeRef}
              src={ANALYSIS_TOOLS[selectedTool].url}
              className="analysis-tools__iframe"
              title={ANALYSIS_TOOLS[selectedTool].name}
              allow="fullscreen"
              scrolling="no"
              onLoad={handleIframeLoad}
              style={{ visibility: isLoading ? "hidden" : "visible" }}
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
