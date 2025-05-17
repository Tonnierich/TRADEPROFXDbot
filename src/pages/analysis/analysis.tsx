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
  const toggleRef = useRef(null)
  const originalToggleRef = useRef(null)
  const intervalRef = useRef(null)

  // Handle iframe loading
  const handleIframeLoad = () => {
    setIsLoading(false)
    console.log("Analysis iframe loaded successfully")
  }

  // Function to create a persistent toggle button
  const createPersistentToggle = () => {
    // Remove any existing toggle button we created
    const existingToggle = document.getElementById("analysis-persistent-toggle")
    if (existingToggle) {
      try {
        document.body.removeChild(existingToggle)
      } catch (e) {
        console.log("Toggle button not in DOM")
      }
    }

    // Create a new toggle button
    const toggle = document.createElement("div")
    toggle.id = "analysis-persistent-toggle"
    toggle.className = "analysis-persistent-toggle"

    // Set the arrow direction based on drawer state
    toggle.innerHTML = run_panel.is_drawer_open ? "▼" : "▲"

    // Add click handler to toggle the run panel
    toggle.addEventListener("click", () => {
      if (typeof run_panel.toggleDrawer === "function") {
        run_panel.toggleDrawer()

        // Update the arrow direction based on drawer state
        setTimeout(() => {
          toggle.innerHTML = run_panel.is_drawer_open ? "▼" : "▲"
        }, 100)
      }
    })

    // Style the toggle to match the existing one
    toggle.style.cssText = `
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: fixed !important;
      top: ${isMobile ? "180px" : "104px"} !important;
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
    `

    // Add to the document body
    document.body.appendChild(toggle)
    toggleRef.current = toggle

    return toggle
  }

  // Initialize the run panel when the component mounts
  useEffect(() => {
    // Important: Set the active tab to ensure the run panel is initialized correctly
    dashboard.setActiveTab(DBOT_TABS.ANALYSIS)

    // Force the run panel to be visible
    if (!run_panel.is_drawer_open) {
      run_panel.toggleDrawer(true)
    }

    // Add a class to the body to help with styling
    document.body.classList.add("dbot-analysis-active")
    if (isMobile) {
      document.body.classList.add("dbot-analysis-mobile")
    }

    // Make sure the run panel wrapper is visible
    const runPanelElement = document.querySelector(".main__run-strategy-wrapper")
    if (runPanelElement) {
      runPanelElement.classList.remove("hidden")
    }

    // Create the persistent toggle button
    createPersistentToggle()

    // Set up an interval to ensure the toggle button is always visible
    intervalRef.current = setInterval(() => {
      const existingToggle = document.getElementById("analysis-persistent-toggle")
      if (!existingToggle) {
        console.log("Toggle button disappeared, recreating...")
        createPersistentToggle()
      } else if (existingToggle) {
        // Update the arrow direction based on drawer state
        existingToggle.innerHTML = run_panel.is_drawer_open ? "▼" : "▲"
      }
    }, 500)

    return () => {
      // Clean up
      document.body.classList.remove("dbot-analysis-active")
      document.body.classList.remove("dbot-analysis-mobile")

      // Clear the interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }

      // Remove the toggle button
      const existingToggle = document.getElementById("analysis-persistent-toggle")
      if (existingToggle) {
        try {
          document.body.removeChild(existingToggle)
        } catch (e) {
          console.log("Toggle button not in DOM during cleanup")
        }
      }
    }
  }, [dashboard, run_panel, isDesktop, isMobile, DBOT_TABS.ANALYSIS])

  const toggleTool = () => {
    setShowTool(!showTool)
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
        <button className="analysis-tools__toggle-button" onClick={toggleTool}>
          <Localize i18n_default_text={showTool ? "Hide Tool" : "Show Tool"} />
        </button>
      </div>

      {showTool ? (
        <div className="analysis-tools__content-wrapper">
          {isLoading && (
            <div className="analysis-tools__loading">
              <div className="analysis-tools__loading-spinner"></div>
              <p>Loading analysis tool...</p>
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

