"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import ChunkLoader from "@/components/loader/chunk-loader"
import { localize } from "@deriv-com/translations"
import "./ai-trading-bots.scss"

type AITradingBotsProps = {}

const AITradingBots: React.FC<AITradingBotsProps> = observer(() => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Your AI Trading Bots app URL
  const AI_TRADING_BOTS_URL = "https://tradeprofx.vercel.app/"

  useEffect(() => {
    // Set a timeout to handle loading state
    const loadingTimeout = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false)
      }
    }, 10000) // 10 seconds timeout

    return () => clearTimeout(loadingTimeout)
  }, [isLoading])

  const handleIframeLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
    setErrorMessage(localize("Failed to load AI Trading Bots. Please check your connection and try again."))
  }

  const handleRetry = () => {
    setIsLoading(true)
    setHasError(false)
    setErrorMessage("")

    // Force iframe reload
    if (iframeRef.current) {
      iframeRef.current.src = AI_TRADING_BOTS_URL
    }
  }

  return (
    <div className="ai-trading-bots">
      <div className="ai-trading-bots__header">
        <h1 className="ai-trading-bots__title">{localize("AI Trading Bots")}</h1>
        <p className="ai-trading-bots__description">
          {localize(
            "Access advanced AI-powered trading bots and automated strategies to enhance your trading experience.",
          )}
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
          title="AI Trading Bots"
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

AITradingBots.displayName = "AITradingBots"

export default AITradingBots
