"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useState, useEffect, useRef } from "react"
import "./strategies.scss"

const Strategies = observer(() => {
  const { isDesktop } = useDevice()
  const [showTradeProfXTool, setShowTradeProfXTool] = useState(false)
  const [iframeHeight, setIframeHeight] = useState("100%")
  const [activeToolUrl, setActiveToolUrl] = useState("https://v0-tradeprofxaccumulator.vercel.app/")
  const containerRef = useRef(null)
  const [showSummary, setShowSummary] = useState(false)

  const toggleTradeProfXTool = (url) => {
    if (url) {
      setActiveToolUrl(url)
      setShowTradeProfXTool(true)
      // Reset summary view when changing tools
      setShowSummary(false)
    } else {
      setShowTradeProfXTool(!showTradeProfXTool)
    }
  }

  const toggleSummary = () => {
    setShowSummary(!showSummary)
  }

  // Calculate and set the iframe height when the tool is shown
  useEffect(() => {
    if (showTradeProfXTool && containerRef.current) {
      const calculateHeight = () => {
        const windowHeight = window.innerHeight
        // Use 80% of the height, but position it from the top to show Deriv balances
        const newHeight = windowHeight * 0.8
        setIframeHeight(`${newHeight}px`)
      }

      // Calculate initially and on resize
      calculateHeight()
      window.addEventListener("resize", calculateHeight)

      return () => {
        window.removeEventListener("resize", calculateHeight)
      }
    }
  }, [showTradeProfXTool])

  return (
    <div className="strategies">
      {showTradeProfXTool ? (
        <div className="strategies__tool-container" ref={containerRef}>
          <div className="strategies__tool-iframe-wrapper">
            <div className="strategies__tool-header">
              <h2 className="strategies__tool-title">
                <Localize
                  i18n_default_text={
                    activeToolUrl.includes("tradeprofxaccumulator")
                      ? "ALL IN ONE TRADEPROFX TOOL"
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
                  className={`strategies__tool-toggle ${showSummary ? "strategies__tool-toggle--active" : ""}`}
                  onClick={toggleSummary}
                >
                  <Localize i18n_default_text={showSummary ? "Hide Summary" : "Show Summary"} />
                </button>
                <button className="strategies__tool-back" onClick={() => toggleTradeProfXTool()}>
                  <Localize i18n_default_text="Back to Strategies" />
                </button>
              </div>
            </div>
            <div className={`strategies__tool-content ${showSummary ? "strategies__tool-content--with-summary" : ""}`}>
              <iframe
                src={activeToolUrl}
                className="strategies__tool-iframe"
                title="Trading Tool"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  display: "block",
                  width: "100%",
                  height: showSummary ? "calc(100% - 220px)" : "100%",
                  border: "none",
                  overflow: "hidden",
                }}
              ></iframe>
              {showSummary && (
                <div className="strategies__tool-summary">
                  <div className="strategies__tool-summary-tabs">
                    <button className="strategies__tool-summary-tab strategies__tool-summary-tab--active">
                      <Localize i18n_default_text="Summary" />
                    </button>
                    <button className="strategies__tool-summary-tab">
                      <Localize i18n_default_text="Transactions" />
                    </button>
                    <button className="strategies__tool-summary-tab">
                      <Localize i18n_default_text="Journal" />
                    </button>
                  </div>
                  <div className="strategies__tool-summary-content">
                    <div className="strategies__tool-summary-message">
                      <p>
                        <Localize i18n_default_text="When you're ready to trade, hit" /> <strong>Run</strong>.
                      </p>
                      <p>
                        <Localize i18n_default_text="You'll be able to track your bot's performance here." />
                      </p>
                    </div>
                    <div className="strategies__tool-summary-stats">
                      <div className="strategies__tool-summary-stat">
                        <span className="strategies__tool-summary-stat-label">
                          <Localize i18n_default_text="Total stake" />
                        </span>
                        <span className="strategies__tool-summary-stat-value">0.00 USD</span>
                      </div>
                      <div className="strategies__tool-summary-stat">
                        <span className="strategies__tool-summary-stat-label">
                          <Localize i18n_default_text="Total payout" />
                        </span>
                        <span className="strategies__tool-summary-stat-value">0.00 USD</span>
                      </div>
                      <div className="strategies__tool-summary-stat">
                        <span className="strategies__tool-summary-stat-label">
                          <Localize i18n_default_text="No. of runs" />
                        </span>
                        <span className="strategies__tool-summary-stat-value">0</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
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

