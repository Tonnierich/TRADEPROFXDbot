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
  const containerRef = useRef(null)

  const toggleTradeProfXTool = () => {
    setShowTradeProfXTool(!showTradeProfXTool)
  }

  // Calculate and set the iframe height when the tool is shown
  useEffect(() => {
    if (showTradeProfXTool && containerRef.current) {
      const calculateHeight = () => {
        const headerHeight = document.querySelector(".strategies__tool-header")?.offsetHeight || 0
        const windowHeight = window.innerHeight
        // Calculate 80% of the available height (reducing by 20%)
        const newHeight = (windowHeight - headerHeight) * 0.8
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
          <div className="strategies__tool-header">
            <h2 className="strategies__tool-title">
              <Localize i18n_default_text="ALL IN ONE TRADEPROFX TOOL" />
            </h2>
            <button className="strategies__tool-back" onClick={toggleTradeProfXTool}>
              <Localize i18n_default_text="Back to Strategies" />
            </button>
          </div>
          <div className="strategies__tool-iframe-wrapper">
            <iframe
              src="https://v0-tradeprofxaccumulator.vercel.app/"
              className="strategies__tool-iframe"
              title="TradeProfX Quantum Bot"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                display: "block",
                width: "100%",
                height: iframeHeight,
                border: "none",
                overflow: "hidden",
              }}
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
                    <button className="strategies__button strategies__button--primary" onClick={toggleTradeProfXTool}>
                      <Localize i18n_default_text="Open TradeProfX Quantum Bot" />
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
