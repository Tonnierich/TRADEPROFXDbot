"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useState, useEffect } from "react"
import "./analysis.scss"

const Analysis = observer(() => {
  const [showTool, setShowTool] = useState(true)
  const [iframeHeight, setIframeHeight] = useState(500)

  // Adjust iframe height based on window size
  useEffect(() => {
    const handleResize = () => {
      // Make sure the iframe doesn't take up too much vertical space
      const maxHeight = window.innerHeight * 0.6
      setIframeHeight(Math.min(500, maxHeight))
    }

    window.addEventListener("resize", handleResize)
    handleResize() // Set initial height

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

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
          <div className="analysis-tools__iframe-wrapper" style={{ height: `${iframeHeight}px` }}>
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