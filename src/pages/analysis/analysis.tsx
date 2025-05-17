"use client"
import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/hooks/useStore"
import { DBOT_TABS } from "@/constants/bot-contents"
import "./analysis.scss"

const Analysis = observer(() => {
  const { isDesktop, isMobile } = useDevice()
  const { run_panel, dashboard } = useStore()
  const [showTool, setShowTool] = useState(true)
  const containerRef = useRef(null)

  // Initialize the run panel when the component mounts
  useEffect(() => {
    // Set the active tab to ANALYSIS to ensure the run panel is initialized correctly
    dashboard.setActiveTab(DBOT_TABS.ANALYSIS)

    // Force the run panel to be visible
    if (!run_panel.is_drawer_open && typeof run_panel.toggleDrawer === "function") {
      run_panel.toggleDrawer(true)
    }

    // Add a class to the body to help with styling
    document.body.classList.add("dbot-analysis-active")
    if (isMobile) {
      document.body.classList.add("dbot-analysis-mobile")
    }

    // Function to ensure run panel elements are visible and properly styled
    const ensureRunPanelVisibility = () => {
      // For the run panel container
      const runPanelContainer = document.querySelector(".run-panel__container")
      if (runPanelContainer) {
        if (isDesktop) {
          runPanelContainer.setAttribute(
            "style",
            "display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; z-index: 9999 !important; position: fixed !important; top: 104px !important; right: 0 !important; width: 366px !important; height: calc(100vh - 104px) !important;"
          )
        } else {
          // Mobile styling
          runPanelContainer.setAttribute(
            "style",
            "display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; z-index: 9999 !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; max-height: 50vh !important;"
          )
        }
      }

      // For the toggle button - position on LEFT side for desktop
      const toggle = document.querySelector(".run-panel__toggle")
      if (toggle) {
        if (isDesktop) {
          toggle.setAttribute(
            "style",
            "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; left: -24px !important; top: 50% !important; transform: translateY(-50%) !important; z-index: 9999 !important; cursor: pointer !important; width: 24px !important; height: 40px !important; justify-content: center !important; align-items: center !important; background-color: var(--general-main-1) !important; border: 1px solid var(--border-normal) !important; border-right: 0 !important; border-radius: 4px 0 0 4px !important;"
          )
          
          // Also update the text content to show the correct arrow direction
          toggle.textContent = "«"
        } else {
          // Mobile styling - position at the top center
          toggle.setAttribute(
            "style",
            "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; top: -24px !important; left: 50% !important; transform: translateX(-50%) rotate(90deg) !important; z-index: 9999 !important; cursor: pointer !important; background-color: var(--general-main-1) !important; border: 1px solid var(--border-normal) !important; border-bottom: 0 !important; border-radius: 4px 4px 0 0 !important; width: 40px !important; height: 24px !important; justify-content: center !important;"
          )
        }
      }
    }

    // Run immediately and set up an interval to keep checking
    ensureRunPanelVisibility()
    const intervalId = setInterval(ensureRunPanelVisibility, 1000)

    // Set up a MutationObserver to watch for changes to the DOM
    const observer = new MutationObserver(() => {
      ensureRunPanelVisibility()
    })
    
    // Start observing the document body
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      document.body.classList.remove("dbot-analysis-active")
      document.body.classList.remove("dbot-analysis-mobile")
      clearInterval(intervalId)
      observer.disconnect()
    }
  }, [dashboard, run_panel, isDesktop, isMobile])

  const toggleTool = () => {
    setShowTool(!showTool)
  }

  return (
    <div className={`analysis-tools ${showTool ? "analysis-tools--with-panel" : ""} ${isMobile ? "analysis-tools--mobile" : ""}`} ref={containerRef}>
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
