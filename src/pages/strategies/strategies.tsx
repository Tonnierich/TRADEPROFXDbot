"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useState, useEffect, useRef } from "react"
import { useStore } from "@/hooks/useStore"
import "./strategies.scss"

const Strategies = observer(() => {
  const { isDesktop } = useDevice()
  const { run_panel, dashboard } = useStore()
  const [showTradeProfXTool, setShowTradeProfXTool] = useState(false)
  const [activeToolUrl, setActiveToolUrl] = useState("https://v0-tradeprofxaccumulator.vercel.app/")
  const containerRef = useRef(null)

  // Initialize the run panel when a tool is shown
  useEffect(() => {
    if (showTradeProfXTool && isDesktop) {
      // Set the active tab to CHART to ensure the run panel is initialized correctly
      dashboard.setActiveTab("CHART")

      // Make sure the run panel is visible by toggling the drawer open
      if (!run_panel.is_drawer_open && typeof run_panel.toggleDrawer === "function") {
        run_panel.toggleDrawer(true)
      }

      // Make sure the run panel wrapper is visible
      const runPanelElement = document.querySelector(".main__run-strategy-wrapper")
      if (runPanelElement) {
        runPanelElement.classList.remove("hidden")
      }
    }
  }, [showTradeProfXTool, dashboard, run_panel, isDesktop])

  // Add class to body when tool is shown to adjust layout
  useEffect(() => {
    if (showTradeProfXTool) {
      document.body.classList.add("show-summary-panel")
    } else {
      document.body.classList.remove("show-summary-panel")
    }

    return () => {
      document.body.classList.remove("show-summary-panel")
    }
  }, [showTradeProfXTool])

  const toggleTradeProfXTool = (url) => {
    if (url) {
      setActiveToolUrl(url)
      setShowTradeProfXTool(true)
    } else {
      setShowTradeProfXTool(!showTradeProfXTool)
    }
  }

  return (
    <div className="strategies" ref={containerRef}>
      {showTradeProfXTool ? (
        <div className="strategies__tool-container">
          <div className="strategies__tool-header">
            <h2 className="strategies__tool-title">
              <Localize
                i18n_default_text={
                  activeToolUrl.includes("tradeprofxaccumulator")
                    ? "ALL IN ONE TRADEPROFX TOOL"
                    : activeToolUrl.includes("deriv-token-and-bots")
                      ? "COMBINATION EVEN/ODD/RISE/FALL BOT"
                      : "DERIV ANALYSIS TOOL"
                }
              />
            </h2>
            <div className="strategies__tool-actions">
              <button
                className={`strategies__tool-switch ${activeToolUrl.includes("tradeprofxaccumulator") ? "strategies__tool-switch--active" : ""}`}
                onClick={() => setActiveToolUrl("https://v0-tradeprofxaccumulator.vercel.app/")}
              >
                <Localize i18n_default_text="TradeProfX" />
              </button>
              <button
                className={`strategies__tool-switch ${activeToolUrl.includes("derivanalysistool") ? "strategies__tool-switch--active" : ""}`}
                onClick={() => setActiveToolUrl("https://v0-derivanalysistool.vercel.app/")}
              >
                <Localize i18n_default_text="Analysis Tool" />
              </button>
              <button
                className={`strategies__tool-switch ${activeToolUrl.includes("deriv-token-and-bots") ? "strategies__tool-switch--active" : ""}`}
                onClick={() => setActiveToolUrl("https://v0-deriv-token-and-bots.vercel.app/")}
              >
                <Localize i18n_default_text="Combination Bot" />
              </button>
              <button className="strategies__tool-back" onClick={() => toggleTradeProfXTool()}>
                <Localize i18n_default_text="Back to Strategies" />
              </button>
            </div>
          </div>
          <div className="strategies__tool-iframe-wrapper">
            <iframe
              src={activeToolUrl}
              className="strategies__tool-iframe"
              title="Trading Tool"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      ) : (
        <>
          <div className="strategies__header">
            <h2 className="strategies__title">
              <Localize i18n_default_text="Trading Strategies" />
            </h2>
            <p className="strategies__description">
              <Localize i18n_default_text="Access our comprehensive trading tools and strategies." />
            </p>
          </div>
          <div className="strategies__content">
            <div className="strategies__section">
              <h3 className="strategies__section-title">
                <Localize i18n_default_text="TRADEPROFX Tools" />
              </h3>
              <div className="strategies__grid">
                <div className="strategies__card strategies__card--featured">
                  <div className="strategies__card-header">
                    <h4 className="strategies__card-title">
                      <Localize i18n_default_text="ALL IN ONE TRADEPROFX TOOL" />
                    </h4>
                    <span className="strategies__card-tag strategies__card-tag--premium">
                      <Localize i18n_default_text="Premium" />
                    </span>
                  </div>
                  <div className="strategies__card-content">
                    <p>
                      <Localize i18n_default_text="Access the complete TradeProfX Quantum Bot with advanced trading features, market analysis, and automated strategies." />
                    </p>
                    <div className="strategies__card-stats">
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Features" />
                        </span>
                        <span className="strategies__card-stat-value">
                          <Localize i18n_default_text="Real-time Analysis, Auto Trading" />
                        </span>
                      </div>
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Compatibility" />
                        </span>
                        <span className="strategies__card-stat-value">
                          <Localize i18n_default_text="All Markets" />
                        </span>
                      </div>
                    </div>
                    <button
                      className="strategies__button strategies__button--primary"
                      onClick={() => toggleTradeProfXTool("https://v0-tradeprofxaccumulator.vercel.app/")}
                    >
                      <Localize i18n_default_text="Open TradeProfX Quantum Bot" />
                    </button>
                  </div>
                </div>

                <div className="strategies__card strategies__card--featured">
                  <div className="strategies__card-header">
                    <h4 className="strategies__card-title">
                      <Localize i18n_default_text="DERIV ANALYSIS TOOL" />
                    </h4>
                    <span className="strategies__card-tag strategies__card-tag--advanced">
                      <Localize i18n_default_text="Advanced" />
                    </span>
                  </div>
                  <div className="strategies__card-content">
                    <p>
                      <Localize i18n_default_text="Comprehensive market analysis tool with advanced charting, indicators, and real-time data for Deriv markets." />
                    </p>
                    <div className="strategies__card-stats">
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Features" />
                        </span>
                        <span className="strategies__card-stat-value">
                          <Localize i18n_default_text="Technical Analysis, Market Insights" />
                        </span>
                      </div>
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Compatibility" />
                        </span>
                        <span className="strategies__card-stat-value">
                          <Localize i18n_default_text="All Deriv Markets" />
                        </span>
                      </div>
                    </div>
                    <button
                      className="strategies__button strategies__button--primary"
                      onClick={() => toggleTradeProfXTool("https://v0-derivanalysistool.vercel.app/")}
                    >
                      <Localize i18n_default_text="Open Deriv Analysis Tool" />
                    </button>
                  </div>
                </div>

                {/* New Combination Bot Card */}
                <div className="strategies__card strategies__card--featured">
                  <div className="strategies__card-header">
                    <h4 className="strategies__card-title">
                      <Localize i18n_default_text="COMBINATION EVEN/ODD/RISE/FALL BOT" />
                    </h4>
                    <span className="strategies__card-tag strategies__card-tag--intermediate">
                      <Localize i18n_default_text="Intermediate" />
                    </span>
                  </div>
                  <div className="strategies__card-content">
                    <p>
                      <Localize i18n_default_text="Powerful trading bot that combines Even/Odd and Rise/Fall strategies with API token integration for automated trading on Deriv." />
                    </p>
                    <div className="strategies__card-stats">
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Features" />
                        </span>
                        <span className="strategies__card-stat-value">
                          <Localize i18n_default_text="API Integration, Multiple Strategies" />
                        </span>
                      </div>
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Compatibility" />
                        </span>
                        <span className="strategies__card-stat-value">
                          <Localize i18n_default_text="Binary Options" />
                        </span>
                      </div>
                    </div>
                    <button
                      className="strategies__button strategies__button--primary"
                      onClick={() => toggleTradeProfXTool("https://v0-deriv-token-and-bots.vercel.app/")}
                    >
                      <Localize i18n_default_text="Open Combination Bot" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default Strategies
