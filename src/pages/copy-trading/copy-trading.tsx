"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { observer } from "mobx-react-lite"
import "./copy-trading.scss"

interface ClientConnection {
  id: string
  token: string
  ws: WebSocket | null
  status: "connecting" | "connected" | "disconnected" | "error"
  balance: number
  accountInfo: any
  lastTrade: any
  totalCopiedTrades: number
  totalProfit: number
}

interface TradeParams {
  contract_type: string
  symbol: string
  amount: number
  duration: number
  duration_unit: string
  basis: string
  currency: string
  barrier?: string
  barrier2?: string
  prediction?: number
  proposal_id?: string
  ask_price?: number
}

const COPYABLE_CONTRACTS = [
  "CALL",
  "PUT",
  "DIGITOVER",
  "DIGITUNDER",
  "DIGITMATCH",
  "DIGITDIFF",
  "HIGHER",
  "LOWER",
  "ONETOUCH",
  "NOTOUCH",
  "EXPIRYRANGE",
  "EXPIRYMISS",
]

const CopyTrading: React.FC = observer(() => {
  const loadSavedData = () => {
    try {
      return {
        savedMasterToken: localStorage.getItem("copytrading_master_token") || "",
        savedClients: JSON.parse(localStorage.getItem("copytrading_clients") || "[]"),
        savedSettings: JSON.parse(
          localStorage.getItem("copytrading_settings") ||
            '{"copyRatio":1,"maxAmount":100,"minAmount":1,"exactCopy":true}',
        ),
        savedIsDemo: localStorage.getItem("copytrading_is_demo") === "true",
      }
    } catch {
      return {
        savedMasterToken: "",
        savedClients: [],
        savedSettings: { copyRatio: 1, maxAmount: 100, minAmount: 1, exactCopy: true },
        savedIsDemo: true,
      }
    }
  }

  const { savedMasterToken, savedClients, savedSettings, savedIsDemo } = loadSavedData()

  const [isActive, setIsActive] = useState(false)
  const [clientToken, setClientToken] = useState("")
  const [masterToken, setMasterToken] = useState(savedMasterToken)
  const [clients, setClients] = useState<ClientConnection[]>([])
  const [masterWs, setMasterWs] = useState<WebSocket | null>(null)
  const [masterBalance, setMasterBalance] = useState(0)
  const [masterAccount, setMasterAccount] = useState("")
  const [isDemo, setIsDemo] = useState(savedIsDemo)
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [copySettings, setCopySettings] = useState(savedSettings)
  const [totalMasterTrades, setTotalMasterTrades] = useState(0)
  const [totalCopiedTrades, setTotalCopiedTrades] = useState(0)
  const [skippedTrades, setSkippedTrades] = useState(0)
  const [appId, setAppId] = useState("75760")

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const lastBalanceRef = useRef<number>(0)
  const processedContractsRef = useRef<Set<string>>(new Set())
  const pendingProposalsRef = useRef<Map<string, TradeParams>>(new Map())
  const portfolioPollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    localStorage.setItem("copytrading_master_token", masterToken)
  }, [masterToken])
  useEffect(() => {
    localStorage.setItem("copytrading_clients", JSON.stringify(clients.map((c) => ({ token: c.token, id: c.id }))))
  }, [clients])
  useEffect(() => {
    localStorage.setItem("copytrading_settings", JSON.stringify(copySettings))
  }, [copySettings])
  useEffect(() => {
    localStorage.setItem("copytrading_is_demo", isDemo.toString())
  }, [isDemo])

  useEffect(() => {
    if (savedClients.length > 0) {
      setClients(
        savedClients.map((sc: any) => ({
          id: sc.id,
          token: sc.token,
          ws: null,
          status: "disconnected" as const,
          balance: 0,
          accountInfo: null,
          lastTrade: null,
          totalCopiedTrades: 0,
          totalProfit: 0,
        })),
      )
    }
  }, [])

  useEffect(() => {
    masterWsRef.current = masterWs
  }, [masterWs])
  useEffect(() => {
    clientsRef.current = clients
  }, [clients])
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const addLog = (message: string, type: "info" | "success" | "error" | "warning" = "info") => {
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    setLogs((prev) => [`${emoji} ${message}`, ...prev.slice(0, 19)])
  }

  const startPortfolioPolling = () => {
    if (portfolioPollingRef.current) clearInterval(portfolioPollingRef.current)
    portfolioPollingRef.current = setInterval(() => {
      if (masterWsRef.current && isActiveRef.current) {
        masterWsRef.current.send(JSON.stringify({ portfolio: 1, req_id: Math.floor(Math.random() * 1000000) }))
      }
    }, 2000)
  }

  const stopPortfolioPolling = () => {
    if (portfolioPollingRef.current) {
      clearInterval(portfolioPollingRef.current)
      portfolioPollingRef.current = null
    }
  }

  const connectMaster = async () => {
    if (!masterToken) return addLog("Enter master token", "error")
    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)
      ws.onopen = () => ws.send(JSON.stringify({ authorize: masterToken, req_id: 1 }))
      ws.onmessage = (event) => handleMasterMessage(JSON.parse(event.data))
      ws.onerror = () => addLog("Master connection error", "error")
      ws.onclose = () => {
        setMasterWs(null)
        stopPortfolioPolling()
      }
      setMasterWs(ws)
    } catch {
      addLog("Failed to connect master", "error")
    }
  }

  const extractTradeParamsFromContract = (contract: any): TradeParams | null => {
    if (!contract.contract_type || !contract.symbol || !contract.buy_price) return null
    if (!COPYABLE_CONTRACTS.includes(contract.contract_type)) {
      setSkippedTrades((prev) => prev + 1)
      return null
    }

    const params: TradeParams = {
      contract_type: contract.contract_type,
      symbol: contract.symbol,
      amount: Math.abs(contract.buy_price),
      duration: contract.duration || 5,
      duration_unit: contract.duration_unit || "t",
      basis: "stake",
      currency: contract.currency || "USD",
    }

    if (contract.barrier) params.barrier = contract.barrier.toString()
    if (contract.barrier2) params.barrier2 = contract.barrier2.toString()
    if (contract.prediction !== undefined) params.prediction = contract.prediction

    return params
  }

  const handleMasterMessage = (data: any) => {
    if (data.error) return addLog(`Master error: ${data.error.message}`, "error")

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        lastBalanceRef.current = data.authorize.balance
        addLog(`Master: ${data.authorize.loginid} ($${data.authorize.balance})`, "success")

        if (masterWsRef.current) {
          masterWsRef.current.send(JSON.stringify({ portfolio: 1, req_id: 2 }))
          masterWsRef.current.send(JSON.stringify({ balance: 1, subscribe: 1, req_id: 3 }))
          masterWsRef.current.send(JSON.stringify({ transaction: 1, subscribe: 1, req_id: 4 }))
        }
        break

      case "balance":
        const newBalance = data.balance.balance
        const balanceChange = newBalance - lastBalanceRef.current
        if (Math.abs(balanceChange) > 0.01 && isActiveRef.current) {
          setMasterBalance(newBalance)
          lastBalanceRef.current = newBalance
          if (balanceChange < 0 && masterWsRef.current) {
            masterWsRef.current.send(JSON.stringify({ portfolio: 1, req_id: 5 }))
          }
        }
        break

      case "portfolio":
        if (data.portfolio?.contracts && isActiveRef.current) {
          const currentTime = Date.now()
          const newContracts = data.portfolio.contracts.filter((contract: any) => {
            const contractTime = new Date(contract.date_start * 1000).getTime()
            const timeDiff = currentTime - contractTime
            return (
              timeDiff < 30000 &&
              timeDiff > 0 &&
              !processedContractsRef.current.has(contract.contract_id.toString()) &&
              contract.buy_price > 0
            )
          })

          newContracts.forEach((contract: any) => {
            processedContractsRef.current.add(contract.contract_id.toString())
            setTotalMasterTrades((prev) => prev + 1)
            const tradeParams = extractTradeParamsFromContract(contract)
            if (tradeParams) {
              addLog(`Copying ${contract.contract_type} $${contract.buy_price}`, "success")
              replicateExactTrade(tradeParams)
            }
          })
        }
        break
    }
  }

  const addClient = () => {
    if (!clientToken.trim()) return
    if (clients.find((c) => c.token === clientToken.trim())) return

    const newClient: ClientConnection = {
      id: `client_${Date.now()}`,
      token: clientToken.trim(),
      ws: null,
      status: "connecting",
      balance: 0,
      accountInfo: null,
      lastTrade: null,
      totalCopiedTrades: 0,
      totalProfit: 0,
    }
    setClients((prev) => [...prev, newClient])
    setClientToken("")
    connectClient(newClient)
  }

  const connectClient = (client: ClientConnection) => {
    try {
      const ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${appId}`)
      ws.onopen = () => ws.send(JSON.stringify({ authorize: client.token, req_id: Math.random() * 1000000 }))
      ws.onmessage = (event) => handleClientMessage(client.id, JSON.parse(event.data))
      ws.onerror = () => updateClientStatus(client.id, "error")
      ws.onclose = () => updateClientStatus(client.id, "disconnected")
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ws } : c)))
    } catch {
      updateClientStatus(client.id, "error")
    }
  }

  const handleClientMessage = (clientId: string, data: any) => {
    if (data.error) return

    switch (data.msg_type) {
      case "authorize":
        updateClient(clientId, { status: "connected", balance: data.authorize.balance, accountInfo: data.authorize })
        break
      case "proposal":
        if (data.proposal?.id) {
          const client = clientsRef.current.find((c) => c.id === clientId)
          client?.ws?.send(
            JSON.stringify({ buy: data.proposal.id, price: data.proposal.ask_price, req_id: Math.random() * 1000000 }),
          )
        }
        break
      case "buy":
        if (data.buy?.contract_id) {
          updateClient(clientId, {
            lastTrade: data.buy,
            totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
          })
          setTotalCopiedTrades((prev) => prev + 1)
          addLog(`Trade copied to ${clientId}`, "success")
        }
        break
    }
  }

  const updateClientStatus = (clientId: string, status: ClientConnection["status"]) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, status } : c)))
  }

  const updateClient = (clientId: string, updates: Partial<ClientConnection>) => {
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, ...updates } : c)))
  }

  const replicateExactTrade = (tradeParams: TradeParams) => {
    const connectedClients = clientsRef.current.filter((c) => c.status === "connected" && c.ws)
    if (connectedClients.length === 0) return

    connectedClients.forEach((client, index) => {
      setTimeout(() => {
        let amount = copySettings.exactCopy ? tradeParams.amount : tradeParams.amount * copySettings.copyRatio
        if (!copySettings.exactCopy) {
          amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))
        }

        const proposalRequest: any = {
          proposal: 1,
          amount,
          basis: tradeParams.basis,
          contract_type: tradeParams.contract_type,
          currency: tradeParams.currency,
          symbol: tradeParams.symbol,
          duration: tradeParams.duration,
          duration_unit: tradeParams.duration_unit,
          req_id: Math.random() * 1000000,
        }

        if (tradeParams.barrier) proposalRequest.barrier = tradeParams.barrier
        if (tradeParams.barrier2) proposalRequest.barrier2 = tradeParams.barrier2
        if (tradeParams.prediction !== undefined) proposalRequest.prediction = tradeParams.prediction

        client.ws?.send(JSON.stringify(proposalRequest))
      }, index * 100)
    })
  }

  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) client.ws.close()
    setClients((prev) => prev.filter((c) => c.id !== clientId))
  }

  const toggleCopyTrading = () => {
    if (!masterWs || clients.filter((c) => c.status === "connected").length === 0) return

    setIsActive(!isActive)
    if (!isActive) {
      processedContractsRef.current.clear()
      startPortfolioPolling()
      setTotalMasterTrades(0)
      setTotalCopiedTrades(0)
      setSkippedTrades(0)
    } else {
      stopPortfolioPolling()
    }
  }

  return (
    <div style={{ padding: "0.5rem", fontSize: "0.7rem", maxWidth: "100%", background: "#f8f9fa" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.3rem",
          background: "white",
          borderRadius: "0.3rem",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.2rem" }}>
          <button
            style={{
              padding: "0.2rem 0.5rem",
              border: "1px solid #ddd",
              borderRadius: "0.2rem",
              background: isDemo ? "#007bff" : "white",
              color: isDemo ? "white" : "black",
              fontSize: "0.7rem",
            }}
            onClick={() => setIsDemo(true)}
          >
            📊 Demo
          </button>
          <button
            style={{
              padding: "0.2rem 0.5rem",
              border: "1px solid #ddd",
              borderRadius: "0.2rem",
              background: !isDemo ? "#007bff" : "white",
              color: !isDemo ? "white" : "black",
              fontSize: "0.7rem",
            }}
            onClick={() => setIsDemo(false)}
          >
            💰 Real
          </button>
        </div>
        <div
          style={{
            padding: "0.2rem 0.5rem",
            borderRadius: "0.2rem",
            fontSize: "0.7rem",
            fontWeight: "bold",
            background: isActive ? "#d4edda" : "#f8d7da",
            color: isActive ? "#155724" : "#721c24",
          }}
        >
          {isActive ? "🎯 ACTIVE" : "🔴 INACTIVE"}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "0.3rem",
          marginBottom: "0.5rem",
          fontSize: "0.6rem",
        }}
      >
        <div style={{ textAlign: "center", padding: "0.3rem", background: "#e3f2fd", borderRadius: "0.2rem" }}>
          <div style={{ fontWeight: "bold", fontSize: "0.8rem" }}>{totalMasterTrades}</div>
          <div>Master</div>
        </div>
        <div style={{ textAlign: "center", padding: "0.3rem", background: "#e8f5e8", borderRadius: "0.2rem" }}>
          <div style={{ fontWeight: "bold", fontSize: "0.8rem" }}>{totalCopiedTrades}</div>
          <div>Copied</div>
        </div>
        <div style={{ textAlign: "center", padding: "0.3rem", background: "#fff3e0", borderRadius: "0.2rem" }}>
          <div style={{ fontWeight: "bold", fontSize: "0.8rem" }}>{skippedTrades}</div>
          <div>Skipped</div>
        </div>
        <div style={{ textAlign: "center", padding: "0.3rem", background: "#fce4ec", borderRadius: "0.2rem" }}>
          <div style={{ fontWeight: "bold", fontSize: "0.8rem" }}>
            {totalMasterTrades > 0 ? Math.round((totalCopiedTrades / totalMasterTrades) * 100) : 0}%
          </div>
          <div>Success</div>
        </div>
      </div>

      {/* App ID */}
      <div style={{ background: "white", padding: "0.3rem", borderRadius: "0.3rem", marginBottom: "0.5rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.2rem", fontSize: "0.7rem" }}>🔧 WebSocket</div>
        <select
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          style={{
            width: "100%",
            padding: "0.2rem",
            fontSize: "0.6rem",
            border: "1px solid #ddd",
            borderRadius: "0.2rem",
          }}
        >
          <option value="75760">app_id=75760 (Better Detection)</option>
          <option value="1089">app_id=1089 (Default)</option>
        </select>
      </div>

      {/* Master */}
      <div style={{ background: "white", padding: "0.3rem", borderRadius: "0.3rem", marginBottom: "0.5rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.2rem", fontSize: "0.7rem" }}>🎯 Master</div>
        <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.2rem" }}>
          <input
            type="password"
            placeholder="Master Token"
            value={masterToken}
            onChange={(e) => setMasterToken(e.target.value)}
            style={{ flex: 1, padding: "0.2rem", fontSize: "0.6rem", border: "1px solid #ddd", borderRadius: "0.2rem" }}
          />
          <button
            onClick={connectMaster}
            style={{
              padding: "0.2rem 0.4rem",
              fontSize: "0.6rem",
              border: "none",
              borderRadius: "0.2rem",
              background: masterWs ? "#28a745" : "#007bff",
              color: "white",
            }}
          >
            {masterWs ? "✅" : "🔗"}
          </button>
        </div>
        {masterWs && (
          <div style={{ fontSize: "0.6rem", color: "#666" }}>
            {masterAccount} - ${masterBalance.toFixed(2)}
          </div>
        )}
      </div>

      {/* Settings */}
      <div style={{ background: "white", padding: "0.3rem", borderRadius: "0.3rem", marginBottom: "0.5rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.2rem", fontSize: "0.7rem" }}>⚙️ Settings</div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.6rem" }}>
          <input
            type="checkbox"
            checked={copySettings.exactCopy}
            onChange={(e) => setCopySettings((prev) => ({ ...prev, exactCopy: e.target.checked }))}
          />
          🎯 Exact Copy
        </label>
        {!copySettings.exactCopy && (
          <div style={{ display: "flex", gap: "0.2rem", marginTop: "0.2rem" }}>
            <input
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={copySettings.copyRatio}
              onChange={(e) => setCopySettings((prev) => ({ ...prev, copyRatio: Number.parseFloat(e.target.value) }))}
              style={{
                width: "40px",
                padding: "0.1rem",
                fontSize: "0.6rem",
                border: "1px solid #ddd",
                borderRadius: "0.2rem",
              }}
            />
            <input
              type="number"
              min="1"
              value={copySettings.maxAmount}
              onChange={(e) => setCopySettings((prev) => ({ ...prev, maxAmount: Number.parseFloat(e.target.value) }))}
              style={{
                width: "40px",
                padding: "0.1rem",
                fontSize: "0.6rem",
                border: "1px solid #ddd",
                borderRadius: "0.2rem",
              }}
            />
          </div>
        )}
      </div>

      {/* Clients */}
      <div style={{ background: "white", padding: "0.3rem", borderRadius: "0.3rem", marginBottom: "0.5rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.2rem", fontSize: "0.7rem" }}>
          👥 Clients ({clients.filter((c) => c.status === "connected").length}/{clients.length})
        </div>
        <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.2rem" }}>
          <input
            type="password"
            placeholder="Client Token"
            value={clientToken}
            onChange={(e) => setClientToken(e.target.value)}
            style={{ flex: 1, padding: "0.2rem", fontSize: "0.6rem", border: "1px solid #ddd", borderRadius: "0.2rem" }}
            onKeyPress={(e) => e.key === "Enter" && addClient()}
          />
          <button
            onClick={addClient}
            style={{
              padding: "0.2rem 0.4rem",
              fontSize: "0.6rem",
              border: "none",
              borderRadius: "0.2rem",
              background: "#007bff",
              color: "white",
            }}
          >
            ➕
          </button>
        </div>

        {clients.length > 0 && (
          <div style={{ maxHeight: "80px", overflowY: "auto" }}>
            {clients.map((client) => (
              <div
                key={client.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.2rem",
                  background: "#f8f9fa",
                  borderRadius: "0.2rem",
                  marginBottom: "0.1rem",
                  fontSize: "0.6rem",
                }}
              >
                <div>
                  <span>{client.accountInfo?.loginid || client.id.slice(-6)}</span>
                  <span style={{ marginLeft: "0.2rem" }}>
                    {client.status === "connected" ? "✅" : client.status === "connecting" ? "🔄" : "❌"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                  <span>${client.balance.toFixed(0)}</span>
                  <span>{client.totalCopiedTrades}</span>
                  <button
                    onClick={() => removeClient(client.id)}
                    style={{
                      padding: "0.1rem 0.2rem",
                      fontSize: "0.5rem",
                      border: "none",
                      borderRadius: "0.1rem",
                      background: "#dc3545",
                      color: "white",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.2rem", marginBottom: "0.5rem" }}>
        <button
          onClick={toggleCopyTrading}
          style={{
            flex: 1,
            padding: "0.3rem",
            fontSize: "0.7rem",
            border: "none",
            borderRadius: "0.2rem",
            fontWeight: "bold",
            background: isActive ? "#dc3545" : "#28a745",
            color: "white",
            opacity: !masterWs || clients.filter((c) => c.status === "connected").length === 0 ? 0.5 : 1,
          }}
          disabled={!masterWs || clients.filter((c) => c.status === "connected").length === 0}
        >
          {isActive ? "⏹️ Stop" : "🎯 Start"}
        </button>
        <button
          onClick={() => setShowLogs(!showLogs)}
          style={{
            padding: "0.3rem 0.5rem",
            fontSize: "0.7rem",
            border: "1px solid #ddd",
            borderRadius: "0.2rem",
            background: "white",
          }}
        >
          📋
        </button>
      </div>

      {/* Logs */}
      {showLogs && (
        <div style={{ background: "white", padding: "0.3rem", borderRadius: "0.3rem", marginBottom: "0.5rem" }}>
          <div style={{ fontWeight: "bold", marginBottom: "0.2rem", fontSize: "0.7rem" }}>📋 Logs</div>
          <div
            style={{
              maxHeight: "100px",
              overflowY: "auto",
              background: "#f8f9fa",
              padding: "0.2rem",
              borderRadius: "0.2rem",
            }}
          >
            {logs.length === 0 ? (
              <div style={{ fontSize: "0.6rem", color: "#666", textAlign: "center" }}>No activity...</div>
            ) : (
              logs.slice(0, 10).map((log, index) => (
                <div key={index} style={{ fontSize: "0.5rem", marginBottom: "0.1rem", fontFamily: "monospace" }}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Contract Support */}
      <div style={{ background: "white", padding: "0.3rem", borderRadius: "0.3rem", fontSize: "0.5rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: "0.2rem" }}>📋 Support</div>
        <div style={{ color: "#28a745" }}>✅ CALL/PUT, DIGITS, HIGHER/LOWER, TOUCH/NOTOUCH</div>
        <div style={{ color: "#dc3545" }}>❌ Multipliers, Accumulators, Vanilla Options</div>
      </div>
    </div>
  )
})

export default CopyTrading
