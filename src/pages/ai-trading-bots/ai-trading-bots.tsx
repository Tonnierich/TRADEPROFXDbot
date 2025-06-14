"use client"

import type React from "react"
import { useState, useEffect } from "react"
import ChunkLoader from "@/components/loader/chunk-loader"
import { localize } from "@deriv-com/translations"
import "./ai-trading-bots.scss"

type Platform = {
  id: string
  name: string
  url: string
  description: string
  allowIframe: boolean
}

const platforms: Platform[] = [
  {
    id: "ai-bots",
    name: "AI Trading Bots",
    url: "https://v0-derivtradingbots.vercel.app/",
    description: "Advanced AI-powered trading bots for automated trading strategies",
    allowIframe: true,
  },
  {
    id: "cursor",
    name: "CURSOR PLATFORM",
    url: "https://tradeprofx.vercel.app/",
    description: "Professional trading platform with advanced tools and analytics",
    allowIframe: false, // This site likely blocks iframe embedding
  },
]

const AITradingBots: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>(platforms[0])
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    // Reset loading state when platform changes
    setIsLoading(true)
    setHasError(false)
    setIframeError(false)

    // Set a timeout to detect if iframe fails to load
    const loadTimeout = setTimeout(() => {
      if (isLoading && !selectedPlatform.allowIframe) {
        setIsLoading(false)
        setIframeError(true)
      }
    }, 5000) // 5 seconds timeout

    return () => clearTimeout(loadTimeout)
  }, [selectedPlatform, isLoading])

  const handleIframeLoad = () => {
    setIsLoading(false)
    setHasError(false)
    setIframeError(false)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
    if (!selectedPlatform.allowIframe) {
      setIframeError(true)
    }
  }

  const retryLoad = () => {
    setHasError(false)
    setIframeError(false)
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
      setSelectedPlatform(platform)

      // If platform doesn't allow iframe, show the external link option
      if (!platform.allowIframe) {
        setIsLoading(false)
        setIframeError(true)
        return
      }

      setIsLoading(true)
      setHasError(false)
      setIframeError(false)

      // Update iframe src for iframe-compatible platforms
      setTimeout(() => {
        const iframe = document.getElementById("ai-trading-bots-iframe") as HTMLIFrameElement
        if (iframe) {
          iframe.src = platform.url
        }
      }, 100)
    }
  }

  const openInNewTab = () => {
    window.open(selectedPlatform.url, "_blank", "noopener,noreferrer")
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
        {isLoading && selectedPlatform.allowIframe && (
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

        {/* Show external link option for platforms that don't allow iframe */}
        {iframeError && !selectedPlatform.allowIframe && (
          <div className="ai-trading-bots__external-link">
            <div className="ai-trading-bots__external-content">
              <h3>Open {selectedPlatform.name}</h3>
              <p>This platform needs to be opened in a new tab for the best experience.</p>
              <button className="ai-trading-bots__open-btn" onClick={openInNewTab}>
                Open {selectedPlatform.name} →
              </button>
              <p className="ai-trading-bots__url-display">{selectedPlatform.url}</p>
            </div>
          </div>
        )}

        {/* Only show iframe for platforms that allow it */}
        {selectedPlatform.allowIframe && (
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
        )}
      </div>
    </div>
  )
}

export default AITradingBots
