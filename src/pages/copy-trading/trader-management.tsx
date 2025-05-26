"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"

interface TraderStats {
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

interface CopierInfo {
  loginid: string
  start_time: number
  min_trade_stake: number
  max_trade_stake: number
  assets: string[]
  trade_types: string[]
  max_trade_stake_per_day: number
  total_profit_loss: number
  total_trades: number
}

const TraderManagement: React.FC = observer(() => {
  const [apiToken, setApiToken] = useState("")
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [allowCopiers, setAllowCopiers] = useState(false)
  const [traderStats, setTraderStats] = useState<TraderStats | null>(null)
  const [copiers, setCopiers] = useState<CopierInfo[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [accountInfo, setAccountInfo] = useState<any>(null)
  const [appId, setAppId] = useState("1089")
  const [isLoading, setIsLoading] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)

  const log = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logEntry = `${timestamp} ${emoji} ${message}`
    setLogs((prev) => [logEntry, ...prev.slice(0, 19)])
    console.log(`[TraderManagement] ${logEntry}`)
  }

  // 🎯 STEP 1: CONNECT TO DERIV API
  const connectToAPI = async () => {
    if (!apiToken.trim()) {
      log("API token required", "error")
      return
    }

    try {
      const websocket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)

      websocket.onopen = () => {
        log("Connected to Deriv API", "success")
        setIsConnected(true)

        // Authorize with API token
        websocket.send(
          JSON.stringify({
            authorize: apiToken.trim(),
            req_id: 1,
          }),
        )
      }

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleAPIResponse(data)
      }

      websocket.onerror = (error) => {
        log("WebSocket error", "error")
        console.error("WebSocket error:", error)
      }

      websocket.onclose = () => {
        log("Disconnected from Deriv API", "warning")
        setIsConnected(false)
        setWs(null)
        wsRef.current = null
      }

      setWs(websocket)
      wsRef.current = websocket
    } catch (error) {
      log(`Connection failed: ${error}`, "error")
    }
  }

  // 🎯 STEP 2: HANDLE API RESPONSES
  const handleAPIResponse = (data: any) => {
    setIsLoading(false)

    if (data.error) {
      log(`API Error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setAccountInfo(data.authorize)
        log(`Authorized: ${data.authorize.loginid}`, "success")

        // Check current settings
        checkCurrentSettings()
        break

      case "get_settings":
        if (data.get_settings) {
          const currentAllowCopiers = data.get_settings.allow_copiers === 1
          setAllowCopiers(currentAllowCopiers)
          log(`Current allow_copiers: ${currentAllowCopiers}`, "info")

          // If copiers are allowed, get stats
          if (currentAllowCopiers) {
            loadTraderStats()
            loadCopiersList()
          }
        }
        break

      case "set_settings":
        if (data.set_settings === 1) {
          log("Settings updated successfully!", "success")
          const newAllowCopiers = data.echo_req.allow_copiers === 1
          setAllowCopiers(newAllowCopiers)

          if (newAllowCopiers) {
            log("🎯 You are now a COPY TRADER! Others can copy your trades.", "success")
            loadTraderStats()
            loadCopiersList()
          } else {
            log("Copy trading disabled. Copiers can no longer copy your trades.", "warning")
            setTraderStats(null)
            setCopiers([])
          }
        }
        break

      case "copytrading_statistics":
        if (data.copytrading_statistics) {
          setTraderStats(data.copytrading_statistics)
          log("Trader statistics loaded", "success")
        }
        break

      case "copytrading_list":
        if (data.copytrading_list) {
          setCopiers(data.copytrading_list)
          log(`Found ${data.copytrading_list.length} copiers`, "info")
        }
        break
    }
  }

  // 🎯 STEP 3: CHECK CURRENT SETTINGS
  const checkCurrentSettings = () => {
    if (wsRef.current) {
      setIsLoading(true)
      wsRef.current.send(
        JSON.stringify({
          get_settings: 1,
          req_id: 2,
        }),
      )
    }
  }

  // 🎯 STEP 4: ENABLE/DISABLE COPY TRADING
  const toggleCopyTrading = (enable: boolean) => {
    if (!wsRef.current) {
      log("Not connected to API", "error")
      return
    }

    setIsLoading(true)
    log(`${enable ? "Enabling" : "Disabling"} copy trading...`, "info")

    wsRef.current.send(
      JSON.stringify({
        set_settings: 1,
        allow_copiers: enable ? 1 : 0,
        req_id: 3,
      }),
    )
  }

  // 🎯 STEP 5: LOAD TRADER STATISTICS
  const loadTraderStats = () => {
    if (!wsRef.current) return

    setIsLoading(true)
    wsRef.current.send(
      JSON.stringify({
        copytrading_statistics: 1,
        req_id: 4,
      }),
    )
  }

  // 🎯 STEP 6: LOAD COPIERS LIST
  const loadCopiersList = () => {
    if (!wsRef.current) return

    setIsLoading(true)
    wsRef.current.send(
      JSON.stringify({
        copytrading_list: 1,
        req_id: 5,
      }),
    )
  }

  // 🎯 STEP 7: GENERATE SHAREABLE TOKEN INFO
  const generateShareableInfo = () => {
    if (!accountInfo || !allowCopiers) return null

    return {
      trader_token: apiToken, // This should be a READ-ONLY token in production
      trader_id: accountInfo.loginid,
      trader_name: accountInfo.loginid,
      app_id: appId,
    }
  }

  // 🎯 STEP 8: COPY TOKEN TO CLIPBOARD
  const copyTokenToClipboard = () => {
    const shareableInfo = generateShareableInfo()
    if (!shareableInfo) return

    const shareText = `🎯 Copy Trading Token
Trader ID: ${shareableInfo.trader_id}
Token: ${shareableInfo.trader_token}
App ID: ${shareableInfo.app_id}

⚠️ This is a READ-ONLY token for copy trading only.`

    navigator.clipboard.writeText(shareText).then(() => {
      log("Token copied to clipboard!", "success")
    })
  }

  // 🎯 CLEANUP
  useEffect(() => {
    return () => {
      if (ws) ws.close()
    }
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  return (
    <div
      style={{
        padding: "16px",
        fontSize: "14px",
        maxHeight: "600px",
        overflowY: "auto",
        background: "#f8f9fa",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          padding: "12px",
          background: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "bold", color: "#2c3e50" }}>👑 Become a Copy Trader</h2>
        <div
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: "bold",
            background: isConnected ? "#d4edda" : "#f8d7da",
            color: isConnected ? "#155724" : "#721c24",
          }}
        >
          {isConnected ? "🟢 CONNECTED" : "🔴 DISCONNECTED"}
        </div>
      </div>

      {/* Connection Section */}
      <div
        style={{
          marginBottom: "16px",
          padding: "16px",
          background: "white",
          borderRadius: "8px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#2c3e50" }}>
          🔗 API Connection
        </h3>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" }}>
          <select
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            style={{
              padding: "8px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "12px",
              width: "80px",
            }}
          >
            <option value="1089">1089</option>
            <option value="75760">75760</option>
          </select>

          <input
            type="password"
            placeholder="Your Deriv API Token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              fontFamily: "monospace",
            }}
          />

          <button
            onClick={connectToAPI}
            disabled={!apiToken.trim() || isLoading}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "4px",
              background: isConnected ? "#28a745" : "#007bff",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: !apiToken.trim() || isLoading ? "not-allowed" : "pointer",
              opacity: !apiToken.trim() || isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "⏳" : isConnected ? "✅ Connected" : "🔗 Connect"}
          </button>
        </div>

        {accountInfo && (
          <div
            style={{
              padding: "12px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>
                <strong>Account:</strong> {accountInfo.loginid}
              </span>
              <span>
                <strong>Balance:</strong> {formatCurrency(accountInfo.balance)}
              </span>
              <span>
                <strong>Currency:</strong> {accountInfo.currency}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Copy Trading Settings */}
      {isConnected && (
        <div
          style={{
            marginBottom: "16px",
            padding: "16px",
            background: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#2c3e50" }}>
            ⚙️ Copy Trading Settings
          </h3>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              background: allowCopiers ? "#d4edda" : "#f8d7da",
              borderRadius: "6px",
              marginBottom: "12px",
            }}
          >
            <div>
              <div style={{ fontWeight: "600", color: allowCopiers ? "#155724" : "#721c24" }}>
                {allowCopiers ? "🎯 Copy Trading ENABLED" : "🔒 Copy Trading DISABLED"}
              </div>
              <div style={{ fontSize: "12px", color: allowCopiers ? "#155724" : "#721c24", marginTop: "4px" }}>
                {allowCopiers
                  ? "Others can copy your trades using your token"
                  : "Enable to allow others to copy your trades"}
              </div>
            </div>

            <button
              onClick={() => toggleCopyTrading(!allowCopiers)}
              disabled={isLoading}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "4px",
                background: allowCopiers ? "#dc3545" : "#28a745",
                color: "white",
                fontSize: "14px",
                fontWeight: "600",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? "⏳" : allowCopiers ? "🔒 Disable" : "🎯 Enable"}
            </button>
          </div>

          {allowCopiers && (
            <div
              style={{
                padding: "12px",
                background: "#fff3cd",
                border: "1px solid #ffeaa7",
                borderRadius: "6px",
                fontSize: "13px",
                lineHeight: "1.4",
              }}
            >
              <div style={{ fontWeight: "600", marginBottom: "8px" }}>📋 Share Your Trading Token:</div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Trader ID:</strong> {accountInfo?.loginid}
              </div>
              <div style={{ marginBottom: "8px" }}>
                <strong>Token:</strong>{" "}
                <code style={{ background: "#f8f9fa", padding: "2px 4px", borderRadius: "2px" }}>
                  {apiToken.slice(0, 20)}...
                </code>
              </div>
              <button
                onClick={copyTokenToClipboard}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  borderRadius: "4px",
                  background: "#007bff",
                  color: "white",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                📋 Copy Token Info
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trader Statistics */}
      {allowCopiers && traderStats && (
        <div
          style={{
            marginBottom: "16px",
            padding: "16px",
            background: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#2c3e50" }}>
              📊 Your Trading Statistics
            </h3>
            <button
              onClick={loadTraderStats}
              style={{
                padding: "4px 8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "white",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              🔄 Refresh
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
            <div style={{ padding: "12px", background: "#e3f2fd", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Total Trades</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#1976d2" }}>{traderStats.total_trades}</div>
            </div>

            <div style={{ padding: "12px", background: "#e8f5e8", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Win Rate</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#388e3c" }}>
                {formatPercentage(traderStats.win_rate)}
              </div>
            </div>

            <div style={{ padding: "12px", background: "#fff3e0", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Total P&L</div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: traderStats.total_profit_loss >= 0 ? "#388e3c" : "#d32f2f",
                }}
              >
                {formatCurrency(traderStats.total_profit_loss)}
              </div>
            </div>

            <div style={{ padding: "12px", background: "#f3e5f5", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Active Copiers</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: "#7b1fa2" }}>{traderStats.copiers_count}</div>
            </div>

            <div style={{ padding: "12px", background: "#fce4ec", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Avg Profit</div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#388e3c" }}>
                {formatCurrency(traderStats.avg_profit)}
              </div>
            </div>

            <div style={{ padding: "12px", background: "#ffebee", borderRadius: "6px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>Avg Loss</div>
              <div style={{ fontSize: "16px", fontWeight: "bold", color: "#d32f2f" }}>
                {formatCurrency(traderStats.avg_loss)}
              </div>
            </div>
          </div>

          {traderStats.last_trade_time > 0 && (
            <div style={{ marginTop: "12px", fontSize: "12px", color: "#666" }}>
              Last trade: {formatDate(traderStats.last_trade_time)}
            </div>
          )}
        </div>
      )}

      {/* Active Copiers */}
      {allowCopiers && copiers.length > 0 && (
        <div
          style={{
            marginBottom: "16px",
            padding: "16px",
            background: "white",
            borderRadius: "8px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#2c3e50" }}>
              👥 Active Copiers ({copiers.length})
            </h3>
            <button
              onClick={loadCopiersList}
              style={{
                padding: "4px 8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                background: "white",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              🔄 Refresh
            </button>
          </div>

          <div style={{ maxHeight: "200px", overflowY: "auto" }}>
            {copiers.map((copier, index) => (
              <div
                key={index}
                style={{
                  padding: "12px",
                  background: "#f8f9fa",
                  borderRadius: "6px",
                  marginBottom: "8px",
                  border: "1px solid #e9ecef",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "600", fontSize: "14px" }}>{copier.loginid}</div>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      Started: {formatDate(copier.start_time)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: "600" }}>{copier.total_trades} trades</div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: copier.total_profit_loss >= 0 ? "#388e3c" : "#d32f2f",
                      }}
                    >
                      {formatCurrency(copier.total_profit_loss)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "8px", fontSize: "11px", color: "#666" }}>
                  <div>
                    Stake Range: {formatCurrency(copier.min_trade_stake)} - {formatCurrency(copier.max_trade_stake)}
                  </div>
                  {copier.assets && copier.assets.length > 0 && (
                    <div>Assets: {copier.assets.slice(0, 3).join(", ")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Logs */}
      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "16px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", fontWeight: "600", color: "#2c3e50" }}>📋 Activity Log</h3>
        <div
          style={{
            maxHeight: "150px",
            overflowY: "auto",
            background: "#f8f9fa",
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #e9ecef",
          }}
        >
          {logs.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#666", textAlign: "center", padding: "16px" }}>
              No activity yet...
            </div>
          ) : (
            logs.slice(0, 10).map((log, index) => (
              <div
                key={index}
                style={{
                  fontSize: "11px",
                  fontFamily: "monospace",
                  marginBottom: "2px",
                  color: "#333",
                  lineHeight: "1.3",
                }}
              >
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: "16px",
          padding: "16px",
          background: "#e8f4fd",
          borderRadius: "8px",
          border: "1px solid #bee5eb",
        }}
      >
        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "600", color: "#0c5460" }}>
          📖 How to Become a Copy Trader:
        </h4>
        <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", lineHeight: "1.5", color: "#0c5460" }}>
          <li>Connect with your Deriv API token</li>
          <li>Enable "Allow Copiers" in settings</li>
          <li>Share your token with potential copiers</li>
          <li>Start trading - your trades will be copied automatically</li>
          <li>Monitor your copiers and performance statistics</li>
        </ol>
        <div style={{ marginTop: "8px", fontSize: "11px", color: "#0c5460" }}>
          <strong>⚠️ Important:</strong> Only share READ-ONLY tokens. Never share tokens with trading permissions.
        </div>
      </div>
    </div>
  )
})

export default TraderManagement
