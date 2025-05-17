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
      // Important: Set the active tab to CHART to ensure the run panel is initialized correctly
      // This matches what's done in main.tsx for the Analysis tab
      dashboard.setActiveTab("CHART")

      // Force the run panel to be visible
      if (!run_panel.is_drawer_open && typeof run_panel.toggleDrawer === "function") {
        run_panel.toggleDrawer(true)
      }

      // Add a class to the body to help with styling
      document.body.classList.add("dbot-analysis-active")

      // Check if the run panel exists in the DOM
      const checkForRunPanel = () => {
        const runPanelContainer = document.querySelector(".run-panel__container")
        
        if (!runPanelContainer) {
          console.log("Run panel not found, attempting to clone from another tab...")
          
          // Try to find the run panel in the DOM (it might be hidden but present)
          const existingRunPanel = document.querySelector(".run-panel")
          
          if (existingRunPanel) {
            console.log("Found existing run panel, making it visible")
            
            // Clone it to ensure we have a clean copy
            const clonedRunPanel = existingRunPanel.cloneNode(true)
            
            // Make sure it's visible and positioned correctly
            clonedRunPanel.classList.add("run-panel--active")
            
            // Append it to the body
            document.body.appendChild(clonedRunPanel)
            
            // Now style it
            styleRunPanelElements()
          } else {
            console.log("No run panel found in DOM")
          }
        } else {
          console.log("Run panel already exists, styling it")
          styleRunPanelElements()
        }
      }

      // Function to style run panel elements
      const styleRunPanelElements = () => {
        // Style the run panel container
        const runPanelContainer = document.querySelector(".run-panel__container")
        if (runPanelContainer) {
          runPanelContainer.setAttribute(
            "style",
            "display: block !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; z-index: 9999 !important; position: fixed !important; top: 104px !important; right: 0 !important; width: 366px !important; height: calc(100vh - 104px) !important;"
          )
        }

        // Style the drawer
        const drawer = document.querySelector(".dc-drawer")
        if (drawer) {
          drawer.setAttribute(
            "style",
            "transform: none !important; visibility: visible !important; opacity: 1 !important; transition: none !important;"
          )
        }

        // Style the toggle button
        const toggle = document.querySelector(".run-panel__toggle")
        if (toggle) {
          toggle.setAttribute(
            "style",
            "display: flex !important; visibility: visible !important; opacity: 1 !important; pointer-events: auto !important; position: absolute !important; left: -24px !important; top: 50% !important; transform: translateY(-50%) !important; z-index: 9999 !important; cursor: pointer !important;"
          )
        }
      }

      // Check for run panel immediately and after a delay
      checkForRunPanel()
      setTimeout(checkForRunPanel, 1000)
      
      // Set up a MutationObserver to watch for changes to the DOM
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            // Check if any run panel elements were added
            const runPanelElements = document.querySelectorAll('.run-panel, .run-panel__container, .run-panel__toggle')
            if (runPanelElements.length > 0) {
              styleRunPanelElements()
            }
          }
        }
      })
      
      // Start observing the document body
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
      
      {/* Debug element to show the status of the run panel */}
      <div 
        style={{
          position: 'fixed',
          bottom: '10px',
          left: '10px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '5px',
          borderRadius: '3px',
          fontSize: '12px',
          zIndex: 10000
        }}
      >
        Run Panel Debug: {run_panel.is_drawer_open ? 'Open' : 'Closed'}
      </div>
    </div>
  )
})

export default Analysis
