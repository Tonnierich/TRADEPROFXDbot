"use client"

import type React from "react"
import { useState } from "react"
import ChunkLoader from "@/components/loader/chunk-loader"
import { localize } from "@deriv-com/translations"
import "./ai-trading-bots.scss"

const AITradingBots: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const retryLoad = () => {
    setHasError(false)
    setIsLoading(true)
    // Force iframe reload by changing src
    const iframe = document.getElementById("ai-trading-bots-iframe") as HTMLIFrameElement
    if (iframe) {
      const currentSrc = iframe.src
      iframe.src = ""
      setTimeout(() => {
        iframe.src = currentSrc
      }, 100)
    }
  }

  return (
    <div className="ai-trading-bots">
      <div className="ai-trading-bots__header">
        <h1 className="ai-trading-bots__title">AI Trading Bots</h1>
        <p className="ai-trading-bots__description">
          Advanced AI-powered trading bots for automated trading strategies
        </p>
      </div>

      <div className="ai-trading-bots__content">
        {isLoading && (
          <div className="ai-trading-bots__loader">
            <ChunkLoader message={localize("Loading AI Trading Bots...")} />
          </div>
        )}

        {hasError && (
          <div className="ai-trading-bots__error">
            <p>Failed to load AI Trading Bots. Please check your connection and try again.</p>
            <button className="ai-trading-bots__retry-btn" onClick={retryLoad}>
              Retry
            </button>
          </div>
        )}

        <iframe
          id="ai-trading-bots-iframe"
          className={`ai-trading-bots__iframe ${isLoading ? "ai-trading-bots__iframe--loading" : ""}`}
          src="https://v0-derivtradingbots.vercel.app/"
          title="AI Trading Bots"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          loading="lazy"
          style={{ display: hasError ? "none" : "block" }}
        />
      </div>
    </div>
  )
}

export default AITradingBots
