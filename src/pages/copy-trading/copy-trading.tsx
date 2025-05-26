"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useStore } from "@/hooks/useStore"
import "./copy-trading.scss"

interface TraderStats {
  trader_id: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  total_profit_loss: number
  win_rate: number
  avg_profit: number
  avg_loss: number
  copiers_count: number
  last_trade_time: number
  performance_probability: number
}

interface CopyingSession {
  copier_token: string
  trader_token: string
  trader_id: string
  start_time: number
  total_profit_loss: number
  total_trades: number
  status: "active" | "stopped"
}

const CopyTrading: React.FC = observer(() => {
  const store = useStore()

  // State management
  const [activeTab, setActiveTab] = useState<"copier" | "trader">("copier")
  const [allowCopiers, setAllowCopiers] = useState(false)
  const [traderToken, setTraderToken] = useState("")
  const [apiToken, setApiToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [traderStats, setTraderStats] = useState<TraderStats | null>(null)
  const [copyingSessions, setCopyingSessions] = useState<CopyingSession[]>([])
  const [myStats, setMyStats] = useState<TraderStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Deriv API connection
  const [ws, setWs] = useState<WebSocket | null>(null)

  useEffect(() => {
    // Initialize WebSocket connection to Deriv API
    const websocket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

    websocket.onopen = () => {
      console.log("Connected to Deriv API")
      setWs(websocket)
    }

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleApiResponse(data)
    }

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error)
      setError("Failed to connect to Deriv API")
    }

    websocket.onclose = () => {
      console.log("Disconnected from Deriv API")
      setWs(null)
    }

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close()
      }
    }
  }, [])

  const handleApiResponse = (data: any) => {
    if (data.error) {
      setError(data.error.message)
      setIsLoading(false)
      return
    }

    switch (data.msg_type) {
      case "set_settings":
        if (data.set_settings === 1) {
          setSuccess("Copy trading settings updated successfully!")
          setAllowCopiers(data.echo_req.allow_copiers === 1)
        }
        break

      case "copytrading_statistics":
        if (data.echo_req.trader_id) {
          setTraderStats(data.copytrading_statistics)
        } else {
          setMyStats(data.copytrading_statistics)
        }
        break

      case "copy_start":
        if (data.copy_start === 1) {
          setSuccess("Started copying trader successfully!")
          loadCopyingSessions()
        }
        break

      case "copy_stop":
        if (data.copy_stop === 1) {
          setSuccess("Stopped copying trader successfully!")
          loadCopyingSessions()
        }
        break

      case "copytrading_list":
        setCopyingSessions(data.copytrading_list || [])
        break
    }

    setIsLoading(false)
  }

  const sendApiRequest = (request: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(request))
      setIsLoading(true)
      setError(null)
      setSuccess(null)
    } else {
      setError("Not connected to Deriv API")
    }
  }

  // Trader functions
  const enableCopyTrading = () => {
    sendApiRequest({
      set_settings: 1,
      allow_copiers: allowCopiers ? 1 : 0,
      authorize: apiToken,
    })
  }

  const generateApiToken = () => {
    window.open("https://app.deriv.com/account/api-token", "_blank")
    setSuccess("Please create a read-only API token and paste it above")
  }

  const loadMyStats = () => {
    if (!apiToken) {
      setError("Please enter your API token first")
      return
    }

    sendApiRequest({
      copytrading_statistics: 1,
      authorize: apiToken,
    })
  }

  // Copier functions
  const startCopying = () => {
    if (!traderToken || !apiToken) {
      setError("Please enter both trader token and your API token")
      return
    }

    sendApiRequest({
      copy_start: 1,
      copy_start: traderToken,
      authorize: apiToken,
    })
  }

  const stopCopying = (traderToken: string) => {
    sendApiRequest({
      copy_stop: 1,
      copy_stop: traderToken,
      authorize: apiToken,
    })
  }

  const loadTraderStats = () => {
    if (!traderToken) {
      setError("Please enter trader token first")
      return
    }

    sendApiRequest({
      copytrading_statistics: 1,
      trader_id: traderToken,
    })
  }

  const loadCopyingSessions = () => {
    if (!apiToken) return

    sendApiRequest({
      copytrading_list: 1,
      authorize: apiToken,
    })
  }

  useEffect(() => {
    if (apiToken && activeTab === "copier") {
      loadCopyingSessions()
    }
  }, [apiToken, activeTab])

  return (
    <div className="copy-trading">
      {/* Header */}
      <div className="copy-trading__header">
        <div className="copy-trading__title">
          <div className="copy-trading__icon">📋</div>
          <h1>Copy Trading</h1>
        </div>
        <p className="copy-trading__description">
          Copy trades from experienced traders or allow others to copy your trades. Available for Options trading only.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="copy-trading__alert copy-trading__alert--error">
          <span className="copy-trading__alert-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="copy-trading__alert copy-trading__alert--success">
          <span className="copy-trading__alert-icon">✅</span>
          <span>{success}</span>
        </div>
      )}

      {/* API Token Section */}
      <div className="copy-trading__section">
        <div className="copy-trading__section-header">
          <span className="copy-trading__section-icon">⚙️</span>
          <h2>API Configuration</h2>
        </div>
        <p className="copy-trading__section-description">Enter your Deriv API token to enable copy trading features</p>

        <div className="copy-trading__input-group">
          <div className="copy-trading__input-wrapper">
            <label htmlFor="api-token">Your API Token</label>
            <input
              id="api-token"
              type="password"
              placeholder="Enter your read-only API token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              className="copy-trading__input"
            />
          </div>
          <button onClick={generateApiToken} className="copy-trading__button copy-trading__button--secondary">
            Generate Token
          </button>
        </div>
        <p className="copy-trading__help-text">Create a read-only API token from your Deriv account settings</p>
      </div>

      {/* Main Tabs */}
      <div className="copy-trading__tabs">
        <div className="copy-trading__tab-buttons">
          <button
            className={`copy-trading__tab-button ${activeTab === "copier" ? "active" : ""}`}
            onClick={() => setActiveTab("copier")}
          >
            <span className="copy-trading__tab-icon">👁️</span>
            Be a Copier
          </button>
          <button
            className={`copy-trading__tab-button ${activeTab === "trader" ? "active" : ""}`}
            onClick={() => setActiveTab("trader")}
          >
            <span className="copy-trading__tab-icon">👤</span>
            Be a Trader
          </button>
        </div>

        {/* Copier Tab Content */}
        {activeTab === "copier" && (
          <div className="copy-trading__tab-content">
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <h2>Copy a Trader</h2>
              </div>
              <p className="copy-trading__section-description">Enter a trader's token to start copying their trades</p>

              <div className="copy-trading__input-group">
                <div className="copy-trading__input-wrapper">
                  <label htmlFor="trader-token">Trader's Token</label>
                  <input
                    id="trader-token"
                    placeholder="Enter trader's read-only token"
                    value={traderToken}
                    onChange={(e) => setTraderToken(e.target.value)}
                    className="copy-trading__input"
                  />
                </div>
                <button
                  onClick={loadTraderStats}
                  className="copy-trading__button copy-trading__button--secondary"
                  disabled={isLoading}
                >
                  <span className="copy-trading__button-icon">👁️</span>
                  Preview
                </button>
              </div>

              {traderStats && (
                <div className="copy-trading__stats-card">
                  <h3>Trader Statistics</h3>
                  <div className="copy-trading__stats-grid">
                    <div className="copy-trading__stat">
                      <div className="copy-trading__stat-value copy-trading__stat-value--success">
                        {traderStats.win_rate.toFixed(1)}%
                      </div>
                      <div className="copy-trading__stat-label">Win Rate</div>
                    </div>
                    <div className="copy-trading__stat">
                      <div className="copy-trading__stat-value">{traderStats.total_trades}</div>
                      <div className="copy-trading__stat-label">Total Trades</div>
                    </div>
                    <div className="copy-trading__stat">
                      <div
                        className={`copy-trading__stat-value ${
                          traderStats.total_profit_loss >= 0
                            ? "copy-trading__stat-value--success"
                            : "copy-trading__stat-value--danger"
                        }`}
                      >
                        ${traderStats.total_profit_loss.toFixed(2)}
                      </div>
                      <div className="copy-trading__stat-label">Total P&L</div>
                    </div>
                    <div className="copy-trading__stat">
                      <div className="copy-trading__stat-value copy-trading__stat-value--info">
                        {traderStats.copiers_count}
                      </div>
                      <div className="copy-trading__stat-label">Copiers</div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={startCopying}
                disabled={!traderToken || !apiToken || isLoading}
                className="copy-trading__button copy-trading__button--primary copy-trading__button--large"
              >
                {isLoading ? (
                  <span className="copy-trading__loading">⏳ Loading...</span>
                ) : (
                  <>
                    <span className="copy-trading__button-icon">▶️</span>
                    Start Copying
                  </>
                )}
              </button>
            </div>

            {/* Active Copy Sessions */}
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <h2>Your Copy Sessions</h2>
              </div>
              <p className="copy-trading__section-description">Manage your active copy trading sessions</p>

              {copyingSessions.length === 0 ? (
                <div className="copy-trading__empty">
                  <div className="copy-trading__empty-icon">📋</div>
                  <p>No active copy sessions</p>
                </div>
              ) : (
                <div className="copy-trading__sessions">
                  {copyingSessions.map((session, index) => (
                    <div key={index} className="copy-trading__session-card">
                      <div className="copy-trading__session-info">
                        <h4>Trader: {session.trader_id}</h4>
                        <p className="copy-trading__session-date">
                          Started: {new Date(session.start_time * 1000).toLocaleDateString()}
                        </p>
                        <div className="copy-trading__session-stats">
                          <span>Trades: {session.total_trades}</span>
                          <span
                            className={
                              session.total_profit_loss >= 0
                                ? "copy-trading__session-profit"
                                : "copy-trading__session-loss"
                            }
                          >
                            P&L: ${session.total_profit_loss.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <div className="copy-trading__session-actions">
                        <span className={`copy-trading__status copy-trading__status--${session.status}`}>
                          {session.status}
                        </span>
                        {session.status === "active" && (
                          <button
                            className="copy-trading__button copy-trading__button--small copy-trading__button--secondary"
                            onClick={() => stopCopying(session.trader_token)}
                          >
                            <span className="copy-trading__button-icon">⏹️</span>
                            Stop
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trader Tab Content */}
        {activeTab === "trader" && (
          <div className="copy-trading__tab-content">
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <h2>Allow Others to Copy You</h2>
              </div>
              <p className="copy-trading__section-description">Enable copy trading to let others copy your trades</p>

              <div className="copy-trading__toggle">
                <label htmlFor="allow-copiers">Allow Copiers</label>
                <input
                  id="allow-copiers"
                  type="checkbox"
                  checked={allowCopiers}
                  onChange={(e) => setAllowCopiers(e.target.checked)}
                  className="copy-trading__checkbox"
                />
              </div>

              <button
                onClick={enableCopyTrading}
                disabled={!apiToken || isLoading}
                className="copy-trading__button copy-trading__button--primary copy-trading__button--large"
              >
                {isLoading ? (
                  <span className="copy-trading__loading">⏳ Loading...</span>
                ) : (
                  <>
                    <span className="copy-trading__button-icon">⚙️</span>
                    Update Settings
                  </>
                )}
              </button>
            </div>

            {/* Share Token */}
            {allowCopiers && (
              <div className="copy-trading__section">
                <div className="copy-trading__section-header">
                  <h2>Share Your Token</h2>
                </div>
                <p className="copy-trading__section-description">Share this read-only token with potential copiers</p>

                <div className="copy-trading__token-share">
                  <div className="copy-trading__input-wrapper">
                    <label htmlFor="trader-token-share">Your Trader Token</label>
                    <input
                      id="trader-token-share"
                      value={apiToken}
                      readOnly
                      className="copy-trading__input copy-trading__input--readonly"
                    />
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(apiToken)}
                    className="copy-trading__button copy-trading__button--secondary"
                  >
                    <span className="copy-trading__button-icon">📋</span>
                    Copy
                  </button>
                </div>

                <div className="copy-trading__warning">
                  <span className="copy-trading__warning-icon">ℹ️</span>
                  <p>Only share read-only tokens. Never share tokens with trading permissions.</p>
                </div>
              </div>
            )}

            {/* Trading Statistics */}
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <h2>Your Trading Statistics</h2>
              </div>
              <p className="copy-trading__section-description">View your performance stats that copiers can see</p>

              <button
                onClick={loadMyStats}
                disabled={!apiToken || isLoading}
                className="copy-trading__button copy-trading__button--secondary"
              >
                {isLoading ? (
                  <span className="copy-trading__loading">⏳ Loading...</span>
                ) : (
                  <>
                    <span className="copy-trading__button-icon">📈</span>
                    Load Statistics
                  </>
                )}
              </button>

              {myStats && (
                <div className="copy-trading__stats-grid">
                  <div className="copy-trading__stat-card">
                    <div className="copy-trading__stat-value copy-trading__stat-value--success">
                      {myStats.win_rate.toFixed(1)}%
                    </div>
                    <div className="copy-trading__stat-label">Win Rate</div>
                  </div>
                  <div className="copy-trading__stat-card">
                    <div className="copy-trading__stat-value">{myStats.total_trades}</div>
                    <div className="copy-trading__stat-label">Total Trades</div>
                  </div>
                  <div className="copy-trading__stat-card">
                    <div
                      className={`copy-trading__stat-value ${
                        myStats.total_profit_loss >= 0
                          ? "copy-trading__stat-value--success"
                          : "copy-trading__stat-value--danger"
                      }`}
                    >
                      ${myStats.total_profit_loss.toFixed(2)}
                    </div>
                    <div className="copy-trading__stat-label">Total P&L</div>
                  </div>
                  <div className="copy-trading__stat-card">
                    <div className="copy-trading__stat-value copy-trading__stat-value--info">
                      {myStats.copiers_count}
                    </div>
                    <div className="copy-trading__stat-label">Copiers</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="copy-trading__info">
        <div className="copy-trading__info-header">
          <span className="copy-trading__info-icon">ℹ️</span>
          <h3>Important Information</h3>
        </div>
        <ul className="copy-trading__info-list">
          <li>• Copy trading is available only for Options trading</li>
          <li>• Always use read-only API tokens for security</li>
          <li>• Past performance doesn't guarantee future results</li>
          <li>• You can stop copying at any time</li>
          <li>• For MT5 copy trading, use MetaQuotes Signals</li>
        </ul>
      </div>
    </div>
  )
})

export default CopyTrading
