"use client"

import { useEffect, useState } from "react"
import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import ChunkLoader from "@/components/loader/chunk-loader"
import "./ai-trading-bots.scss"

const AITradingBots = observer(() => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Set loading to false after iframe loads
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000) // Give iframe time to load

    return () => clearTimeout(timer)
  }, [])

  const handleIframeLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setError("Failed to load AI Trading Bots application")
  }

  return (
    <div className="ai-trading-bots">
      <div className="ai-trading-bots__header">
        <h2 className="ai-trading-bots__title">
          <Localize i18n_default_text="AI Trading Bots" />
        </h2>
        <p className="ai-trading-bots__description">
          <Localize i18n_default_text="Advanced AI-powered trading bots with real-time signals and automated strategies" />
        </p>
      </div>

      <div className="ai-trading-bots__content">
        {isLoading && (
          <div className="ai-trading-bots__loader">
            <ChunkLoader message="Loading AI Trading Bots..." />
          </div>
        )}

        {error && (
          <div className="ai-trading-bots__error">
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null)
                setIsLoading(true)
                // Force iframe reload
                const iframe = document.getElementById("ai-trading-bots-iframe") as HTMLIFrameElement
                if (iframe) {
                  iframe.src = iframe.src
                }
              }}
              className="ai-trading-bots__retry-btn"
            >
              <Localize i18n_default_text="Retry" />
            </button>
          </div>
        )}

        <iframe
          id="ai-trading-bots-iframe"
          src="https://v0-derivtradingbots.vercel.app/"
          className={`ai-trading-bots__iframe ${isLoading ? "ai-trading-bots__iframe--loading" : ""}`}
          title="AI Trading Bots Application"
          frameBorder="0"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  )
})

export default AITradingBots
