"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useStore } from "@/hooks/useStore"
import { Button, Icon, Text, Input, Loading } from "@deriv/components"
import { localize } from "@deriv/translations"
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
          <Icon icon="IcCopy" size={32} />
          <Text size="xl" weight="bold">
            {localize("Copy Trading")}
          </Text>
        </div>
        <Text size="sm" color="less-prominent">
          {localize(
            "Copy trades from experienced traders or allow others to copy your trades. Available for Options trading only.",
          )}
        </Text>
      </div>

      {/* Alerts */}
      {error && (
        <div className="copy-trading__alert copy-trading__alert--error">
          <Icon icon="IcAlertDanger" size={16} />
          <Text size="xs" color="loss-danger">
            {error}
          </Text>
        </div>
      )}

      {success && (
        <div className="copy-trading__alert copy-trading__alert--success">
          <Icon icon="IcCheckmarkCircle" size={16} />
          <Text size="xs" color="profit-success">
            {success}
          </Text>
        </div>
      )}

      {/* API Token Section */}
      <div className="copy-trading__section">
        <div className="copy-trading__section-header">
          <Icon icon="IcSettings" size={20} />
          <Text size="sm" weight="bold">
            {localize("API Configuration")}
          </Text>
        </div>
        <Text size="xs" color="less-prominent">
          {localize("Enter your Deriv API token to enable copy trading features")}
        </Text>

        <div className="copy-trading__input-group">
          <Input
            type="password"
            label={localize("Your API Token")}
            placeholder={localize("Enter your read-only API token")}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
          />
          <Button onClick={generateApiToken} secondary small>
            {localize("Generate Token")}
          </Button>
        </div>
        <Text size="xxs" color="less-prominent">
          {localize("Create a read-only API token from your Deriv account settings")}
        </Text>
      </div>

      {/* Main Tabs */}
      <div className="copy-trading__tabs">
        <div className="copy-trading__tab-buttons">
          <Button
            className={`copy-trading__tab-button ${activeTab === "copier" ? "active" : ""}`}
            onClick={() => setActiveTab("copier")}
            secondary={activeTab !== "copier"}
            small
          >
            <Icon icon="IcEye" size={16} />
            {localize("Be a Copier")}
          </Button>
          <Button
            className={`copy-trading__tab-button ${activeTab === "trader" ? "active" : ""}`}
            onClick={() => setActiveTab("trader")}
            secondary={activeTab !== "trader"}
            small
          >
            <Icon icon="IcUser" size={16} />
            {localize("Be a Trader")}
          </Button>
        </div>

        {/* Copier Tab Content */}
        {activeTab === "copier" && (
          <div className="copy-trading__tab-content">
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <Text size="sm" weight="bold">
                  {localize("Copy a Trader")}
                </Text>
              </div>
              <Text size="xs" color="less-prominent">
                {localize("Enter a trader's token to start copying their trades")}
              </Text>

              <div className="copy-trading__input-group">
                <Input
                  label={localize("Trader's Token")}
                  placeholder={localize("Enter trader's read-only token")}
                  value={traderToken}
                  onChange={(e) => setTraderToken(e.target.value)}
                />
                <Button onClick={loadTraderStats} secondary small disabled={isLoading}>
                  <Icon icon="IcEye" size={16} />
                  {localize("Preview")}
                </Button>
              </div>

              {traderStats && (
                <div className="copy-trading__stats-card">
                  <Text size="sm" weight="bold">
                    {localize("Trader Statistics")}
                  </Text>
                  <div className="copy-trading__stats-grid">
                    <div className="copy-trading__stat">
                      <Text size="lg" weight="bold" color="profit-success">
                        {traderStats.win_rate.toFixed(1)}%
                      </Text>
                      <Text size="xs" color="less-prominent">
                        {localize("Win Rate")}
                      </Text>
                    </div>
                    <div className="copy-trading__stat">
                      <Text size="lg" weight="bold">
                        {traderStats.total_trades}
                      </Text>
                      <Text size="xs" color="less-prominent">
                        {localize("Total Trades")}
                      </Text>
                    </div>
                    <div className="copy-trading__stat">
                      <Text
                        size="lg"
                        weight="bold"
                        color={traderStats.total_profit_loss >= 0 ? "profit-success" : "loss-danger"}
                      >
                        ${traderStats.total_profit_loss.toFixed(2)}
                      </Text>
                      <Text size="xs" color="less-prominent">
                        {localize("Total P&L")}
                      </Text>
                    </div>
                    <div className="copy-trading__stat">
                      <Text size="lg" weight="bold" color="blue">
                        {traderStats.copiers_count}
                      </Text>
                      <Text size="xs" color="less-prominent">
                        {localize("Copiers")}
                      </Text>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={startCopying} disabled={!traderToken || !apiToken || isLoading} primary large>
                {isLoading ? <Loading /> : <Icon icon="IcPlay" size={16} />}
                {localize("Start Copying")}
              </Button>
            </div>

            {/* Active Copy Sessions */}
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <Text size="sm" weight="bold">
                  {localize("Your Copy Sessions")}
                </Text>
              </div>
              <Text size="xs" color="less-prominent">
                {localize("Manage your active copy trading sessions")}
              </Text>

              {copyingSessions.length === 0 ? (
                <div className="copy-trading__empty">
                  <Icon icon="IcCopy" size={48} />
                  <Text size="sm" color="less-prominent">
                    {localize("No active copy sessions")}
                  </Text>
                </div>
              ) : (
                <div className="copy-trading__sessions">
                  {copyingSessions.map((session, index) => (
                    <div key={index} className="copy-trading__session-card">
                      <div className="copy-trading__session-info">
                        <Text size="sm" weight="bold">
                          {localize("Trader")}: {session.trader_id}
                        </Text>
                        <Text size="xs" color="less-prominent">
                          {localize("Started")}: {new Date(session.start_time * 1000).toLocaleDateString()}
                        </Text>
                        <div className="copy-trading__session-stats">
                          <Text size="xs">
                            {localize("Trades")}: {session.total_trades}
                          </Text>
                          <Text size="xs" color={session.total_profit_loss >= 0 ? "profit-success" : "loss-danger"}>
                            P&L: ${session.total_profit_loss.toFixed(2)}
                          </Text>
                        </div>
                      </div>
                      <div className="copy-trading__session-actions">
                        <span className={`copy-trading__status copy-trading__status--${session.status}`}>
                          {session.status}
                        </span>
                        {session.status === "active" && (
                          <Button size="small" secondary onClick={() => stopCopying(session.trader_token)}>
                            <Icon icon="IcStop" size={12} />
                            {localize("Stop")}
                          </Button>
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
                <Text size="sm" weight="bold">
                  {localize("Allow Others to Copy You")}
                </Text>
              </div>
              <Text size="xs" color="less-prominent">
                {localize("Enable copy trading to let others copy your trades")}
              </Text>

              <div className="copy-trading__toggle">
                <Text size="sm">{localize("Allow Copiers")}</Text>
                <input
                  type="checkbox"
                  checked={allowCopiers}
                  onChange={(e) => setAllowCopiers(e.target.checked)}
                  className="copy-trading__checkbox"
                />
              </div>

              <Button onClick={enableCopyTrading} disabled={!apiToken || isLoading} primary large>
                {isLoading ? <Loading /> : <Icon icon="IcSettings" size={16} />}
                {localize("Update Settings")}
              </Button>
            </div>

            {/* Share Token */}
            {allowCopiers && (
              <div className="copy-trading__section">
                <div className="copy-trading__section-header">
                  <Text size="sm" weight="bold">
                    {localize("Share Your Token")}
                  </Text>
                </div>
                <Text size="xs" color="less-prominent">
                  {localize("Share this read-only token with potential copiers")}
                </Text>

                <div className="copy-trading__token-share">
                  <Input label={localize("Your Trader Token")} value={apiToken} readOnly />
                  <Button onClick={() => navigator.clipboard.writeText(apiToken)} secondary small>
                    <Icon icon="IcCopy" size={16} />
                  </Button>
                </div>

                <div className="copy-trading__warning">
                  <Icon icon="IcInfo" size={16} />
                  <Text size="xs" color="less-prominent">
                    {localize("Only share read-only tokens. Never share tokens with trading permissions.")}
                  </Text>
                </div>
              </div>
            )}

            {/* Trading Statistics */}
            <div className="copy-trading__section">
              <div className="copy-trading__section-header">
                <Text size="sm" weight="bold">
                  {localize("Your Trading Statistics")}
                </Text>
              </div>
              <Text size="xs" color="less-prominent">
                {localize("View your performance stats that copiers can see")}
              </Text>

              <Button onClick={loadMyStats} disabled={!apiToken || isLoading} secondary>
                {isLoading ? <Loading /> : <Icon icon="IcTrendUp" size={16} />}
                {localize("Load Statistics")}
              </Button>

              {myStats && (
                <div className="copy-trading__stats-grid">
                  <div className="copy-trading__stat-card">
                    <Text size="lg" weight="bold" color="profit-success">
                      {myStats.win_rate.toFixed(1)}%
                    </Text>
                    <Text size="xs" color="less-prominent">
                      {localize("Win Rate")}
                    </Text>
                  </div>
                  <div className="copy-trading__stat-card">
                    <Text size="lg" weight="bold">
                      {myStats.total_trades}
                    </Text>
                    <Text size="xs" color="less-prominent">
                      {localize("Total Trades")}
                    </Text>
                  </div>
                  <div className="copy-trading__stat-card">
                    <Text
                      size="lg"
                      weight="bold"
                      color={myStats.total_profit_loss >= 0 ? "profit-success" : "loss-danger"}
                    >
                      ${myStats.total_profit_loss.toFixed(2)}
                    </Text>
                    <Text size="xs" color="less-prominent">
                      {localize("Total P&L")}
                    </Text>
                  </div>
                  <div className="copy-trading__stat-card">
                    <Text size="lg" weight="bold" color="blue">
                      {myStats.copiers_count}
                    </Text>
                    <Text size="xs" color="less-prominent">
                      {localize("Copiers")}
                    </Text>
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
          <Icon icon="IcInfo" size={20} />
          <Text size="sm" weight="bold" color="blue">
            {localize("Important Information")}
          </Text>
        </div>
        <ul className="copy-trading__info-list">
          <li>
            <Text size="xs" color="blue">
              • {localize("Copy trading is available only for Options trading")}
            </Text>
          </li>
          <li>
            <Text size="xs" color="blue">
              • {localize("Always use read-only API tokens for security")}
            </Text>
          </li>
          <li>
            <Text size="xs" color="blue">
              • {localize("Past performance doesn't guarantee future results")}
            </Text>
          </li>
          <li>
            <Text size="xs" color="blue">
              • {localize("You can stop copying at any time")}
            </Text>
          </li>
          <li>
            <Text size="xs" color="blue">
              • {localize("For MT5 copy trading, use MetaQuotes Signals")}
            </Text>
          </li>
        </ul>
      </div>
    </div>
  )
})

export default CopyTrading

