"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import ChunkLoader from "@/components/loader/chunk-loader"
import { localize } from "@deriv-com/translations"
import { LegacyOpenLink1pxIcon } from "@deriv/quill-icons/Legacy"
import "./ai-trading-bots.scss"

type AITradingBotsDualProps = {}

const AITradingBotsDual: React.FC<AITradingBotsDualProps> = observer(() => {
  const [activeTab, setActiveTab] = useState<"bots" | "tradeprofx">("bots")
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const AI_TRADING_BOTS_URL = "https://v0-derivtradingbots.vercel.app"
  const TRADEPROFX_URL = "https://tradeprofx.vercel.app"

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
      }
    }, 10000)

    return () => clearTimeout(loadingTimeout)
  }, [isLoading])

  const handleIframeLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
    setErrorMessage(localize("Failed to load application. Please check your connection and try again."))
  }

  const handleRetry = () => {
    setIsLoading(true)
    setHasError(false)
    setErrorMessage("")

    if (iframeRef.current) {
      iframeRef.current.src = activeTab === "bots" ? AI_TRADING_BOTS_URL : TRADEPROFX_URL
    }
  }

  const switchTab = (tab: "bots" | "tradeprofx") => {
    if (tab === "tradeprofx") {
      // For TradeProfX, open in new tab instead of iframe
      window.open(TRADEPROFX_URL, "_blank", "noopener,noreferrer")
      return
    }

    setActiveTab(tab)
    setIsLoading(true)
    setHasError(false)
  }

  return (
    <div className="ai-trading-bots">
      <div className="ai-trading-bots__header">
        <h1 className="ai-trading-bots__title">{localize("AI Trading Platforms")}</h1>
        <p className="ai-trading-bots__description">
          {localize("Choose your preferred AI trading platform for automated strategies.")}
        </p>

        {/* Tab Navigation */}
        <div className="ai-trading-bots__tabs">
          <button
            className={`ai-trading-bots__tab ${activeTab === "bots" ? "ai-trading-bots__tab--active" : ""}`}
            onClick={() => switchTab("bots")}
          >
            {localize("AI Trading Bots")}
          </button>
          <button
            className="ai-trading-bots__tab ai-trading-bots__tab--external"
            onClick={() => switchTab("tradeprofx")}
          >
            <LegacyOpenLink1pxIcon width="14" height="14" />
            {localize("TradeProfX Platform")}
          </button>
        </div>
      </div>

      <div className="ai-trading-bots__content">
        {isLoading && (
          <div className="ai-trading-bots__loader">
            <ChunkLoader message={localize("Loading AI Trading Platform...")} />
          </div>
        )}

        {hasError && (
          <div className="ai-trading-bots__error">
            <p>{errorMessage}</p>
            <button className="ai-trading-bots__retry-btn" onClick={handleRetry}>
              {localize("Retry")}
            </button>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={AI_TRADING_BOTS_URL}
          className={`ai-trading-bots__iframe ${isLoading ? "ai-trading-bots__iframe--loading" : ""}`}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="AI Trading Platform"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
          style={{
            display: hasError ? "none" : "block",
          }}
        />
      </div>
    </div>
  )
})

AITradingBotsDual.displayName = "AITradingBotsDual"

export default AITradingBotsDual
