"use client"

import type React from "react"
import { useState } from "react"
import ChunkLoader from "@/components/loader/chunk-loader"
import { localize } from "@deriv-com/translations"
import "./ai-trading-bots.scss"

type Platform = {
  id: string
  name: string
  url: string
  description: string
}

const platforms: Platform[] = [
  {
    id: "ai-bots",
    name: "AI Trading Bots",
    url: "https://v0-derivtradingbots.vercel.app/",
    description: "Advanced AI-powered trading bots for automated trading strategies",
  },
  {
    id: "cursor",
    name: "CURSOR PLATFORM",
    url: "https://tradeprofx.vercel.app/",
    description: "Professional trading platform with advanced tools and analytics",
  },
]

const AITradingBots: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(platforms[0])

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

  const switchPlatform = (platform: Platform) => {
    if (platform.id !== selectedPlatform.id) {
      setIsLoading(true)
      setHasError(false)
      setSelectedPlatform(platform)

      // Update iframe src
      const iframe = document.getElementById("ai-trading-bots-iframe") as HTMLIFrameElement
      if (iframe) {
        iframe.src = platform.url
      }
    }
  }

  return (
    <div className="ai-trading-bots">
      <div className="ai-trading-bots__header">
        <h1 className="ai-trading-bots__title">Trading Platforms</h1>
        <p className="ai-trading-bots__description">{selectedPlatform.description}</p>

        {/* Platform Switcher */}
        <div className="ai-trading-bots__platform-switcher">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              className={`ai-trading-bots__platform-btn ${
                selectedPlatform.id === platform.id ? "ai-trading-bots__platform-btn--active" : ""
              }`}
              onClick={() => switchPlatform(platform)}
            >
              {platform.name}
            </button>
          ))}
        </div>
      </div>

      <div className="ai-trading-bots__content">
        {isLoading && (
          <div className="ai-trading-bots__loader">
            <ChunkLoader message={localize(`Loading ${selectedPlatform.name}...`)} />
          </div>
        )}

        {hasError && (
          <div className="ai-trading-bots__error">
            <p>Failed to load {selectedPlatform.name}. Please check your connection and try again.</p>
            <button className="ai-trading-bots__retry-btn" onClick={retryLoad}>
              Retry
            </button>
          </div>
        )}

        <iframe
          id="ai-trading-bots-iframe"
          className={`ai-trading-bots__iframe ${isLoading ? "ai-trading-bots__iframe--loading" : ""}`}
          src={selectedPlatform.url}
          title={selectedPlatform.name}
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
