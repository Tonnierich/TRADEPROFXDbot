"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useState, useEffect } from "react"
import "./analysis.scss"

const Analysis = observer(() => {
  const [showTool, setShowTool] = useState(true)

  // Add class to body when tool is shown to adjust layout
  useEffect(() => {
    if (showTool) {
      document.body.classList.add("show-summary-panel")
    } else {
      document.body.classList.remove("show-summary-panel")
    }

    return () => {
      document.body.classList.remove("show-summary-panel")
    }
  }, [showTool])

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
