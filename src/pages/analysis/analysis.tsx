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
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef(null)
  const iframeRef = useRef(null)
  const initializedRef = useRef(false)

  // Handle iframe loading
  const handleIframeLoad = () => {
    setIsLoading(false);
    console.log("Analysis iframe loaded successfully");
  };

  // Initialize the run panel when the component mounts
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    // First initialize the analysis tool without the run panel
    setIsLoading(true);
    
    // Add a class to the body to help with styling
    document.body.classList.add("dbot-analysis-active")
    if (isMobile) {
      document.body.classList.add("dbot-analysis-mobile")
    }

    // Store the original active tab to restore it later if needed
    const originalActiveTab = dashboard.active_tab;
    console.log("Original active tab:", originalActiveTab);

    // Set up an interval to keep the active tab as ANALYSIS
    const keepAnalysisActiveInterval = setInterval(() => {
      // Check if the active tab has changed from ANALYSIS
      if (dashboard.active_tab !== DBOT_TABS.ANALYSIS) {
        console.log("Tab changed from ANALYSIS to", dashboard.active_tab, "- forcing back to ANALYSIS");
        dashboard.setActiveTab(DBOT_TABS.ANALYSIS);
      }
    }, 500);

    // Delayed initialization of run panel to avoid performance issues
    const initRunPanel = () => {
      // Force the run panel to be visible
      if (!run_panel.is_drawer_open && typeof run_panel.toggleDrawer === "function") {
        run_panel.toggleDrawer(true);
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

      // Run once after a delay
      setTimeout(ensureRunPanelVisibility, 500);
    };

    // Initialize run panel after the iframe has had time to load
    const timeoutId = setTimeout(initRunPanel, 1000);

    // Override the dashboard's setActiveTab method to prevent changing from ANALYSIS
    const originalSetActiveTab = dashboard.setActiveTab;
    dashboard.setActiveTab = function(tab) {
      console.log("Attempt to set active tab to:", tab);
      if (tab !== DBOT_TABS.ANALYSIS && document.body.classList.contains("dbot-analysis-active")) {
        console.log("Preventing tab change from ANALYSIS to", tab);
        return;
      }
      originalSetActiveTab.call(this, tab);
    };

    return () => {
      document.body.classList.remove("dbot-analysis-active")
      document.body.classList.remove("dbot-analysis-mobile")
      clearTimeout(timeoutId);
      clearInterval(keepAnalysisActiveInterval);
      
      // Restore the original setActiveTab method
      dashboard.setActiveTab = originalSetActiveTab;
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
          {isLoading && (
            <div className="analysis-tools__loading">
              <div className="analysis-tools__loading-spinner"></div>
              <p>Please wait, loading analysis tool...</p>
            </div>
          )}
          <div className="analysis-tools__iframe-container">
            <iframe
              ref={iframeRef}
              src="https://v0-convert-to-react-eta.vercel.app/"
              className="analysis-tools__iframe"
              title="TRADEPROFX Analysis Tool"
              allow="fullscreen"
              scrolling="no"
              onLoad={handleIframeLoad}
              style={{ visibility: isLoading ? 'hidden' : 'visible' }}
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
