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

  // Get the toggleDrawer function from the run_panel store
  const { toggleDrawer, is_drawer_open } = run_panel

  // Get the active_tab and set_active_tab from dashboard store
  const { active_tab, setActiveTab } = dashboard

  const toggleTradeProfXTool = (url) => {
    if (url) {
      setActiveToolUrl(url)
      setShowTradeProfXTool(true)

      // When opening a tool, ensure the run panel is visible
      if (isDesktop && !is_drawer_open) {
        toggleDrawer(true)
      }
    } else {
      setShowTradeProfXTool(!showTradeProfXTool)
    }
  }

  // When the component mounts or when showTradeProfXTool changes,
  // update the active tab in the dashboard store to enable the run panel
  useEffect(() => {
    if (showTradeProfXTool) {
      // Set the active tab to CHART or another value that enables the run panel
      // This should match one of the values in DBOT_TABS that shows the run panel
      setActiveTab("CHART")
    }
  }, [showTradeProfXTool, setActiveTab])

  return (
    <div className="strategies">
      {showTradeProfXTool ? (
        <div className="strategies__tool-container" ref={containerRef}>
          <div className="strategies__tool-header">
            <h2 className="strategies__tool-title">
              <Localize
                i18n_default_text={
                  activeToolUrl.includes("tradeprofxaccumulator") ? "ALL IN ONE TRADEPROFX TOOL" : "DERIV ANALYSIS TOOL"
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
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
})

export default Strategies
