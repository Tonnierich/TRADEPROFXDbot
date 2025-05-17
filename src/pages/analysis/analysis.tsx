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
  const mobileToggleRef = useRef(null)

  // Handle iframe loading
  const handleIframeLoad = () => {
    setIsLoading(false);
    console.log("Analysis iframe loaded successfully");
  };

  // Function to create a mobile toggle button
  const createMobileToggle = () => {
    // Only proceed if we're on mobile
    if (!isMobile) return null;
    
    // Create the toggle element if it doesn't exist
    if (!mobileToggleRef.current) {
      const toggle = document.createElement('div');
      toggle.className = 'run-panel__mobile-toggle';
      toggle.textContent = '«';
      toggle.onclick = () => {
        if (typeof run_panel.toggleDrawer === "function") {
          run_panel.toggleDrawer();
        }
      };
      
      // Style the toggle
      toggle.style.cssText = `
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: fixed !important;
        top: ${document.querySelector('.analysis-tools__compact-header')?.offsetHeight + 10}px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        z-index: 10000 !important;
        width: 60px !important;
        height: 24px !important;
        background-color: var(--general-main-1) !important;
        border: 1px solid var(--border-normal) !important;
        border-radius: 4px !important;
        justify-content: center !important;
        align-items: center !important;
        cursor: pointer !important;
        font-size: 16px !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
      `;
      
      mobileToggleRef.current = toggle;
      document.body.appendChild(toggle);
    }
    
    return mobileToggleRef.current;
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

    // Ensure we're on the ANALYSIS tab
    if (dashboard.active_tab !== DBOT_TABS.ANALYSIS) {
      dashboard.setActiveTab(DBOT_TABS.ANALYSIS);
    }

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
              "display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; z-index: 9999 !important; position: fixed !important; bottom: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; max-height: 50vh !important; border-top: 1px solid var(--border-normal) !important;"
            )
          }
        }

        // For desktop, style the toggle button on the LEFT side
        if (isDesktop) {
          const toggle = document.querySelector(".run-panel__toggle")
          if (toggle) {
            toggle.setAttribute(
              "style",
              "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; left: -24px !important; top: 50% !important; transform: translateY(-50%) !important; z-index: 9999 !important; cursor: pointer !important; width: 24px !important; height: 40px !important; justify-content: center !important; align-items: center !important; background-color: var(--general-main-1) !important; border: 1px solid var(--border-normal) !important; border-right: 0 !important; border-radius: 4px 0 0 4px !important;"
            )
            
            // Update the text content to show the correct arrow direction
            toggle.textContent = "«"
          }
        }
        
        // For mobile, create a custom toggle button
        if (isMobile) {
          createMobileToggle();
        }
      }

      // Run once after a delay
      setTimeout(ensureRunPanelVisibility, 500);
    };

    // Initialize run panel after the iframe has had time to load
    const timeoutId = setTimeout(initRunPanel, 1000);

    return () => {
      document.body.classList.remove("dbot-analysis-active")
      document.body.classList.remove("dbot-analysis-mobile")
      clearTimeout(timeoutId);
      
      // Remove the mobile toggle if it exists
      if (mobileToggleRef.current) {
        document.body.removeChild(mobileToggleRef.current);
        mobileToggleRef.current = null;
      }
    }
  }, [dashboard, run_panel, isDesktop, isMobile])

  // Set up an additional effect to handle device type changes
  useEffect(() => {
    if (isMobile) {
      createMobileToggle();
    } else if (mobileToggleRef.current) {
      document.body.removeChild(mobileToggleRef.current);
      mobileToggleRef.current = null;
    }
  }, [isMobile]);

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
