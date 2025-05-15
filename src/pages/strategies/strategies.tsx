"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import "./strategies.scss"

const Strategies = observer(() => {
  const { isDesktop } = useDevice()

  const openTradeProfXTool = () => {
    window.open("https://v0-tradeprofxaccumulator.vercel.app/", "_blank")
  }

  return (
    <div className="strategies">
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
                <button className="strategies__button strategies__button--primary" onClick={openTradeProfXTool}>
                  <Localize i18n_default_text="Open TradeProfX Quantum Bot" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default Strategies

