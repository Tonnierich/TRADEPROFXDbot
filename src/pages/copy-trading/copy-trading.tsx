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

const CopyTrading: React.FC = observer(() => {
  // Load saved data from localStorage on component mount
  const loadSavedData = () => {
    try {
      const savedMasterToken = localStorage.getItem("copytrading_master_token") || ""
      const savedClients = JSON.parse(localStorage.getItem("copytrading_clients") || "[]")
      const savedSettings = JSON.parse(
        localStorage.getItem("copytrading_settings") ||
          JSON.stringify({
            copyRatio: 1,
            maxAmount: 100,
            minAmount: 1,
            exactCopy: true,
          }),
      )
      const savedIsDemo = localStorage.getItem("copytrading_is_demo") === "true"

      return { savedMasterToken, savedClients, savedSettings, savedIsDemo }
    } catch (error) {
      console.error("Error loading saved data:", error)
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
  const [showLogs, setShowLogs] = useState(true)
  const [copySettings, setCopySettings] = useState(savedSettings)

  const masterWsRef = useRef<WebSocket | null>(null)
  const clientsRef = useRef<ClientConnection[]>([])
  const isActiveRef = useRef(false)
  const lastBalanceRef = useRef<number>(0)
  const processedContractsRef = useRef<Set<string>>(new Set())
  const pendingProposalsRef = useRef<Map<string, TradeParams>>(new Map())
  const lastTradeTimeRef = useRef<number>(0)

  // Save data to localStorage whenever state changes
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

  // Restore clients on component mount
  useEffect(() => {
    if (savedClients.length > 0) {
      const restoredClients = savedClients.map((savedClient: any) => ({
        id: savedClient.id,
        token: savedClient.token,
        ws: null,
        status: "disconnected" as const,
        balance: 0,
        accountInfo: null,
        lastTrade: null,
        totalCopiedTrades: 0,
        totalProfit: 0,
      }))
      setClients(restoredClients)
      addLog(`Restored ${restoredClients.length} saved clients`, "info")
    }
  }, [])

  // Auto-reconnect master if token exists
  useEffect(() => {
    if (masterToken && !masterWs) {
      addLog("Auto-connecting to saved master account...", "info")
      setTimeout(() => connectMaster(), 1000)
    }
  }, [masterToken])

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
    const timestamp = new Date().toLocaleTimeString()
    const emoji = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"
    const logMessage = `[${timestamp}] ${emoji} ${message}`
    setLogs((prev) => [logMessage, ...prev.slice(0, 49)])
    console.log(`[CopyTrading] ${message}`)
  }

  const connectMaster = async () => {
    if (!masterToken) {
      addLog("Please enter master API token", "error")
      return
    }

    try {
      addLog("Connecting to master account...")
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog("Master WebSocket connected, authorizing...")
        ws.send(
          JSON.stringify({
            authorize: masterToken,
            req_id: 1,
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleMasterMessage(data)
      }

      ws.onerror = (error) => {
        addLog("Master WebSocket connection error", "error")
        console.error("Master WebSocket error:", error)
      }

      ws.onclose = () => {
        addLog("Master WebSocket connection closed", "warning")
        setMasterWs(null)
      }

      setMasterWs(ws)
    } catch (error) {
      addLog("Failed to connect master account", "error")
      console.error("Master connection error:", error)
    }
  }

  const extractTradeParamsFromData = (data: any): TradeParams | null => {
    try {
      // Try to extract from different message types
      let params: any = {}

      if (data.transaction) {
        params = data.transaction
      } else if (data.echo_req) {
        params = data.echo_req
      } else if (data.buy) {
        params = data.buy
      } else {
        return null
      }

      // Validate required fields
      if (!params.contract_type || !params.symbol || !params.amount) {
        addLog(`Missing required fields in trade data: ${JSON.stringify(params)}`, "warning")
        return null
      }

      // Ensure amount is positive
      const amount = Math.abs(Number(params.amount))
      if (amount <= 0) {
        addLog(`Invalid amount: ${params.amount}`, "error")
        return null
      }

      const tradeParams: TradeParams = {
        contract_type: params.contract_type,
        symbol: params.symbol,
        amount: amount,
        duration: params.duration || 5,
        duration_unit: params.duration_unit || "t",
        basis: params.basis || "stake",
        currency: params.currency || "USD",
      }

      // Add optional parameters
      if (params.barrier) tradeParams.barrier = params.barrier.toString()
      if (params.barrier2) tradeParams.barrier2 = params.barrier2.toString()
      if (params.prediction !== undefined) tradeParams.prediction = params.prediction

      return tradeParams
    } catch (error) {
      addLog(`Error extracting trade params: ${error.message}`, "error")
      return null
    }
  }

  const handleMasterMessage = (data: any) => {
    console.log("🔍 Master message:", data)

    if (data.error) {
      addLog(`Master API error: ${data.error.message}`, "error")
      return
    }

    switch (data.msg_type) {
      case "authorize":
        setMasterAccount(data.authorize.loginid)
        setMasterBalance(data.authorize.balance)
        lastBalanceRef.current = data.authorize.balance
        addLog(`Master authorized: ${data.authorize.loginid} ($${data.authorize.balance})`, "success")

        // Subscribe to multiple streams for comprehensive trade detection
        if (masterWsRef.current) {
          // Portfolio for contract tracking
          masterWsRef.current.send(
            JSON.stringify({
              portfolio: 1,
              subscribe: 1,
              req_id: 2,
            }),
          )

          // Balance for trade detection
          masterWsRef.current.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: 3,
            }),
          )

          // Transaction stream for real-time detection
          masterWsRef.current.send(
            JSON.stringify({
              transaction: 1,
              subscribe: 1,
              req_id: 4,
            }),
          )

          addLog("Subscribed to portfolio, balance, and transaction streams", "success")
        }
        break

      case "balance":
        const newBalance = data.balance.balance
        const balanceChange = newBalance - lastBalanceRef.current

        if (Math.abs(balanceChange) > 0.01 && isActiveRef.current) {
          setMasterBalance(newBalance)
          lastBalanceRef.current = newBalance

          if (balanceChange < 0) {
            addLog(`Balance decreased: $${balanceChange.toFixed(2)} - Trade detected!`, "info")
            // Get portfolio to find the new trade
            if (masterWsRef.current) {
              masterWsRef.current.send(
                JSON.stringify({
                  portfolio: 1,
                  req_id: 5,
                }),
              )
            }
          }
        }
        break

      case "portfolio":
        if (data.portfolio && data.portfolio.contracts && isActiveRef.current) {
          const contracts = data.portfolio.contracts

          // Find recent contracts (within last 10 seconds)
          const recentContracts = contracts.filter((contract: any) => {
            const contractTime = new Date(contract.date_start * 1000).getTime()
            const now = Date.now()
            const timeDiff = now - contractTime
            return timeDiff < 10000 && !processedContractsRef.current.has(contract.contract_id.toString())
          })

          if (recentContracts.length > 0) {
            const latestContract = recentContracts[0]
            const contractId = latestContract.contract_id.toString()

            processedContractsRef.current.add(contractId)
            addLog(`Portfolio contract found: ${latestContract.contract_type} on ${latestContract.symbol}`, "info")

            // Create trade params from portfolio contract
            const tradeParams: TradeParams = {
              contract_type: latestContract.contract_type,
              symbol: latestContract.symbol,
              amount: latestContract.buy_price,
              duration: latestContract.duration || 5,
              duration_unit: latestContract.duration_unit || "t",
              basis: "stake",
              currency: latestContract.currency || "USD",
            }

            // Extract barriers from shortcode if available
            if (latestContract.shortcode) {
              const shortcodeParts = latestContract.shortcode.split("_")

              // For digit contracts, extract barrier from shortcode
              if (["DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF"].includes(latestContract.contract_type)) {
                const barrierPart = shortcodeParts[shortcodeParts.length - 1]
                if (/^\d$/.test(barrierPart)) {
                  tradeParams.barrier = barrierPart
                }
              }
            }

            // Add other barriers if present
            if (latestContract.barrier) tradeParams.barrier = latestContract.barrier.toString()
            if (latestContract.barrier2) tradeParams.barrier2 = latestContract.barrier2.toString()
            if (latestContract.prediction !== undefined) tradeParams.prediction = latestContract.prediction

            addLog(`📋 Portfolio trade params: ${JSON.stringify(tradeParams)}`, "info")
            replicateExactTrade(tradeParams)
          }
        }
        break

      case "transaction":
        if (data.transaction && data.transaction.action === "buy" && isActiveRef.current) {
          const tradeParams = extractTradeParamsFromData(data)
          if (tradeParams) {
            addLog(`🚨 Transaction trade detected: ${tradeParams.contract_type} on ${tradeParams.symbol}`, "success")
            replicateExactTrade(tradeParams)
          }
        }
        break

      case "proposal":
        if (data.proposal && data.proposal.id && isActiveRef.current) {
          const proposalId = data.proposal.id
          const echoReq = data.echo_req

          if (echoReq) {
            const tradeParams = extractTradeParamsFromData({ echo_req: echoReq })
            if (tradeParams) {
              tradeParams.proposal_id = proposalId
              tradeParams.ask_price = data.proposal.ask_price
              pendingProposalsRef.current.set(proposalId, tradeParams)
              addLog(`📝 Stored proposal: ${proposalId} for ${tradeParams.contract_type}`, "info")
            }
          }
        }
        break

      case "buy":
        if (data.buy && data.buy.contract_id && isActiveRef.current) {
          addLog(`💰 Master executed trade: ${data.buy.contract_id}`, "success")

          // Check if we have stored proposal details
          const echoReq = data.echo_req
          if (echoReq && echoReq.buy) {
            const proposalId = echoReq.buy
            const storedParams = pendingProposalsRef.current.get(proposalId)

            if (storedParams) {
              addLog(`🎯 Replicating from stored proposal: ${proposalId}`, "info")
              replicateExactTrade(storedParams)
              pendingProposalsRef.current.delete(proposalId)
            }
          }
        }
        break
    }
  }

  const addClient = async () => {
    if (!clientToken.trim()) {
      addLog("Please enter client token", "error")
      return
    }

    if (clients.find((c) => c.token === clientToken.trim())) {
      addLog("Client already added", "warning")
      return
    }

    const clientId = `client_${Date.now()}`
    const newClient: ClientConnection = {
      id: clientId,
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

  const connectClient = async (client: ClientConnection) => {
    try {
      addLog(`Connecting client ${client.id}...`)
      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

      ws.onopen = () => {
        addLog(`Client ${client.id} WebSocket connected, authorizing...`)
        ws.send(
          JSON.stringify({
            authorize: client.token,
            req_id: Math.floor(Math.random() * 1000000),
          }),
        )
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        handleClientMessage(client.id, data)
      }

      ws.onerror = (error) => {
        addLog(`Client ${client.id} WebSocket error`, "error")
        updateClientStatus(client.id, "error")
        console.error(`Client ${client.id} error:`, error)
      }

      ws.onclose = () => {
        addLog(`Client ${client.id} WebSocket closed`, "warning")
        updateClientStatus(client.id, "disconnected")
      }

      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ws } : c)))
    } catch (error) {
      addLog(`Failed to connect client ${client.id}`, "error")
      updateClientStatus(client.id, "error")
    }
  }

  const handleClientMessage = (clientId: string, data: any) => {
    console.log(`👤 Client ${clientId} message:`, data)

    if (data.error) {
      addLog(`Client ${clientId} error: ${data.error.message}`, "error")
      if (data.error.code === "InvalidToken") {
        updateClientStatus(clientId, "error")
      }
      return
    }

    switch (data.msg_type) {
      case "authorize":
        updateClient(clientId, {
          status: "connected",
          balance: data.authorize.balance,
          accountInfo: data.authorize,
        })
        addLog(`Client ${clientId} authorized: ${data.authorize.loginid} ($${data.authorize.balance})`, "success")

        const client = clientsRef.current.find((c) => c.id === clientId)
        if (client?.ws) {
          client.ws.send(
            JSON.stringify({
              balance: 1,
              subscribe: 1,
              req_id: Math.floor(Math.random() * 1000000),
            }),
          )
        }
        break

      case "balance":
        updateClient(clientId, { balance: data.balance.balance })
        addLog(`Client ${clientId} balance updated: $${data.balance.balance.toFixed(2)}`)
        break

      case "proposal":
        if (data.proposal && data.proposal.id) {
          const client = clientsRef.current.find((c) => c.id === clientId)
          if (client?.ws) {
            addLog(`Client ${clientId} proposal received, executing buy...`)
            client.ws.send(
              JSON.stringify({
                buy: data.proposal.id,
                price: data.proposal.ask_price,
                req_id: Math.floor(Math.random() * 1000000),
              }),
            )
          }
        } else if (data.proposal && data.proposal.error) {
          addLog(`Client ${clientId} proposal error: ${data.proposal.error}`, "error")
        }
        break

      case "buy":
        if (data.buy) {
          updateClient(clientId, {
            lastTrade: data.buy,
            totalCopiedTrades: (clients.find((c) => c.id === clientId)?.totalCopiedTrades || 0) + 1,
          })
          addLog(`🎯 EXACT TRADE COPIED to client ${clientId}: ${data.buy.contract_id}`, "success")
        } else if (data.buy && data.buy.error) {
          addLog(`Client ${clientId} buy error: ${data.buy.error}`, "error")
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

  const validateTradeParams = (tradeParams: TradeParams): boolean => {
    const { contract_type, symbol, amount } = tradeParams

    // Basic validation
    if (!contract_type || !symbol || !amount || amount <= 0) {
      addLog(
        `ERROR: Invalid basic parameters - contract_type: ${contract_type}, symbol: ${symbol}, amount: ${amount}`,
        "error",
      )
      return false
    }

    // Contract-specific validation
    if (["DIGITOVER", "DIGITUNDER", "DIGITMATCH", "DIGITDIFF"].includes(contract_type)) {
      if (!tradeParams.barrier) {
        addLog(`ERROR: ${contract_type} requires barrier parameter`, "error")
        return false
      }
    }

    if (["EXPIRYRANGE", "EXPIRYMISS"].includes(contract_type)) {
      if (!tradeParams.barrier || !tradeParams.barrier2) {
        addLog(`ERROR: ${contract_type} requires barrier and barrier2 parameters`, "error")
        return false
      }
    }

    if (["HIGHER", "LOWER", "ONETOUCH", "NOTOUCH"].includes(contract_type)) {
      if (!tradeParams.barrier) {
        addLog(`ERROR: ${contract_type} requires barrier parameter`, "error")
        return false
      }
    }

    return true
  }

  const replicateExactTrade = (tradeParams: TradeParams) => {
    const connectedClients = clientsRef.current.filter((c) => c.status === "connected" && c.ws)

    if (connectedClients.length === 0) {
      addLog("No connected clients to replicate trade", "warning")
      return
    }

    // Validate trade parameters
    if (!validateTradeParams(tradeParams)) {
      addLog(`❌ Trade validation failed: ${JSON.stringify(tradeParams)}`, "error")
      return
    }

    addLog(`🎯 EXACT REPLICATION to ${connectedClients.length} client(s)`, "success")
    addLog(`📋 VALIDATED TRADE PARAMS: ${JSON.stringify(tradeParams)}`, "info")

    connectedClients.forEach((client, index) => {
      setTimeout(() => {
        try {
          // Calculate amount - use exact copy or apply ratio
          let amount = copySettings.exactCopy ? tradeParams.amount : tradeParams.amount * copySettings.copyRatio

          // Apply min/max limits only if not exact copy
          if (!copySettings.exactCopy) {
            amount = Math.max(copySettings.minAmount, Math.min(copySettings.maxAmount, amount))
          }

          // Ensure amount is positive and reasonable
          amount = Math.abs(amount)
          if (amount <= 0) {
            addLog(`Client ${client.id} invalid amount: ${amount}`, "error")
            return
          }

          // Check client balance (leave 20% buffer)
          if (amount > client.balance * 0.8) {
            addLog(`Client ${client.id} insufficient balance for $${amount} trade`, "warning")
            return
          }

          // Create EXACT proposal request
          const proposalRequest: any = {
            proposal: 1,
            amount: amount,
            basis: tradeParams.basis,
            contract_type: tradeParams.contract_type,
            currency: tradeParams.currency,
            symbol: tradeParams.symbol,
            duration: tradeParams.duration,
            duration_unit: tradeParams.duration_unit,
            req_id: Math.floor(Math.random() * 1000000),
          }

          // Add required parameters based on contract type
          if (tradeParams.barrier) {
            proposalRequest.barrier = tradeParams.barrier
            addLog(`Including barrier: ${tradeParams.barrier}`)
          }
          if (tradeParams.barrier2) {
            proposalRequest.barrier2 = tradeParams.barrier2
            addLog(`Including barrier2: ${tradeParams.barrier2}`)
          }
          if (tradeParams.prediction !== undefined) {
            proposalRequest.prediction = tradeParams.prediction
            addLog(`Including prediction: ${tradeParams.prediction}`)
          }

          addLog(`🚀 SENDING PROPOSAL to client ${client.id}: ${tradeParams.contract_type} $${amount}`)
          console.log(`📤 Full Proposal for client ${client.id}:`, proposalRequest)

          client.ws?.send(JSON.stringify(proposalRequest))
        } catch (error) {
          addLog(`Failed to replicate trade to client ${client.id}: ${error.message}`, "error")
          console.error(`Replication error for client ${client.id}:`, error)
        }
      }, index * 100)
    })
  }

  const sendTestTrade = () => {
    if (!isActive) {
      addLog("Copy trading not active", "error")
      return
    }

    const testTrade: TradeParams = {
      contract_type: "CALL",
      symbol: "R_50",
      amount: 1,
      duration: 5,
      duration_unit: "t",
      basis: "stake",
      currency: "USD",
    }

    addLog("Sending test trade...", "info")
    replicateExactTrade(testTrade)
  }

  const removeClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId)
    if (client?.ws) {
      client.ws.close()
    }
    setClients((prev) => prev.filter((c) => c.id !== clientId))
    addLog(`Client ${clientId} removed`)
  }

  const clearAllData = () => {
    localStorage.removeItem("copytrading_master_token")
    localStorage.removeItem("copytrading_clients")
    localStorage.removeItem("copytrading_settings")
    localStorage.removeItem("copytrading_is_demo")

    setMasterToken("")
    setClients([])
    setCopySettings({ copyRatio: 1, maxAmount: 100, minAmount: 1, exactCopy: true })
    setIsDemo(true)
    setIsActive(false)

    if (masterWs) masterWs.close()
    clients.forEach((client) => client.ws?.close())

    addLog("All data cleared and connections closed", "info")
  }

  const reconnectAll = () => {
    addLog("Reconnecting all accounts...", "info")

    if (masterToken && !masterWs) {
      connectMaster()
    }

    clients.forEach((client) => {
      if (client.status !== "connected") {
        connectClient(client)
      }
    })
  }

  const toggleCopyTrading = () => {
    if (!masterWs) {
      addLog("Master account not connected", "error")
      return
    }

    if (clients.filter((c) => c.status === "connected").length === 0) {
      addLog("No connected clients", "error")
      return
    }

    setIsActive(!isActive)
    if (!isActive) {
      addLog("🎯 EXACT COPY TRADING STARTED - Multi-stream monitoring...", "success")
      processedContractsRef.current.clear()
      pendingProposalsRef.current.clear()
      lastTradeTimeRef.current = Date.now()
    } else {
      addLog("COPY TRADING STOPPED", "warning")
    }
  }

  const syncClients = () => {
    addLog("Syncing all clients...")
    clients.forEach((client) => {
      if (client.status === "disconnected" || client.status === "error") {
        connectClient(client)
      }
    })
  }

  const disconnectAll = () => {
    if (masterWs) {
      masterWs.close()
    }
    clients.forEach((client) => {
      if (client.ws) {
        client.ws.close()
      }
    })
    setIsActive(false)
    addLog("All connections closed")
  }

  return (
    <div className="copy-trading-compact">
      {/* Header */}
      <div className="ct-header">
        <div className="ct-mode-toggle">
          <button className={`ct-mode-btn ${isDemo ? "active" : ""}`} onClick={() => setIsDemo(true)}>
            📊 Demo
          </button>
          <button className={`ct-mode-btn ${!isDemo ? "active" : ""}`} onClick={() => setIsDemo(false)}>
            💰 Real
          </button>
        </div>
        <div className={`ct-status ${isActive ? "active" : "inactive"}`}>
          {isActive ? "🎯 EXACT COPY MODE" : "🔴 INACTIVE"}
        </div>
      </div>

      {/* Master Account */}
      <div className="ct-section">
        <h3>🎯 Master Account</h3>
        <div className="ct-input-row">
          <input
            type="password"
            placeholder="Master API Token"
            value={masterToken}
            onChange={(e) => setMasterToken(e.target.value)}
            className="ct-input"
          />
          <button onClick={connectMaster} className="ct-btn ct-btn-primary" disabled={!masterToken || !!masterWs}>
            {masterWs ? "✅ Connected" : "🔗 Connect"}
          </button>
        </div>
        {masterWs && (
          <div className="ct-account-info">
            <span>📋 {masterAccount}</span>
            <span>💰 ${masterBalance.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Copy Settings */}
      <div className="ct-section">
        <h3>⚙️ Copy Settings</h3>
        <div className="ct-settings-row">
          <div className="ct-setting">
            <label>
              <input
                type="checkbox"
                checked={copySettings.exactCopy}
                onChange={(e) => setCopySettings((prev) => ({ ...prev, exactCopy: e.target.checked }))}
              />
              🎯 Exact Copy (Same Amount)
            </label>
          </div>
        </div>
        {!copySettings.exactCopy && (
          <div className="ct-settings-row">
            <div className="ct-setting">
              <label>Ratio</label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={copySettings.copyRatio}
                onChange={(e) => setCopySettings((prev) => ({ ...prev, copyRatio: Number.parseFloat(e.target.value) }))}
                className="ct-input-small"
              />
            </div>
            <div className="ct-setting">
              <label>Max $</label>
              <input
                type="number"
                min="1"
                value={copySettings.maxAmount}
                onChange={(e) => setCopySettings((prev) => ({ ...prev, maxAmount: Number.parseFloat(e.target.value) }))}
                className="ct-input-small"
              />
            </div>
            <div className="ct-setting">
              <label>Min $</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={copySettings.minAmount}
                onChange={(e) => setCopySettings((prev) => ({ ...prev, minAmount: Number.parseFloat(e.target.value) }))}
                className="ct-input-small"
              />
            </div>
          </div>
        )}
      </div>

      {/* Client Management */}
      <div className="ct-section">
        <h3>
          👥 Clients ({clients.filter((c) => c.status === "connected").length}/{clients.length})
        </h3>
        <div className="ct-input-row">
          <input
            type="password"
            placeholder="Client API Token"
            value={clientToken}
            onChange={(e) => setClientToken(e.target.value)}
            className="ct-input"
            onKeyPress={(e) => e.key === "Enter" && addClient()}
          />
          <button onClick={addClient} className="ct-btn ct-btn-secondary">
            ➕ Add
          </button>
          <button onClick={syncClients} className="ct-btn ct-btn-secondary">
            🔄 Sync
          </button>
        </div>

        {clients.length > 0 && (
          <div className="ct-clients-list">
            {clients.map((client) => (
              <div key={client.id} className="ct-client-item">
                <div className="ct-client-info">
                  <span className="ct-client-id">{client.accountInfo?.loginid || client.id.slice(-6)}</span>
                  <span className={`ct-client-status ct-status-${client.status}`}>
                    {client.status === "connected" ? "✅" : client.status === "connecting" ? "🔄" : "❌"}
                  </span>
                </div>
                <div className="ct-client-details">
                  <span>${client.balance.toFixed(2)}</span>
                  <span>{client.totalCopiedTrades} trades</span>
                </div>
                <button onClick={() => removeClient(client.id)} className="ct-btn-remove">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="ct-controls">
        <button
          onClick={toggleCopyTrading}
          className={`ct-main-btn ${isActive ? "stop" : "start"}`}
          disabled={!masterWs || clients.filter((c) => c.status === "connected").length === 0}
        >
          {isActive ? "⏹️ Stop Exact Copy" : "🎯 Start Exact Copy"}
        </button>
        <button onClick={sendTestTrade} className="ct-btn ct-btn-secondary" disabled={!isActive}>
          🧪 Test Trade
        </button>
        <button onClick={reconnectAll} className="ct-btn ct-btn-secondary">
          🔄 Reconnect All
        </button>
        <button onClick={() => setShowLogs(!showLogs)} className="ct-btn ct-btn-secondary">
          📋 {showLogs ? "Hide" : "Show"} Logs
        </button>
        <button onClick={clearAllData} className="ct-btn ct-btn-danger">
          🗑️ Clear All
        </button>
      </div>

      {/* Activity Log */}
      {showLogs && (
        <div className="ct-section">
          <h3>📋 Activity Log (Multi-Stream Detection)</h3>
          <div className="ct-logs">
            {logs.length === 0 ? (
              <div className="ct-no-logs">No activity yet...</div>
            ) : (
              logs.slice(0, 30).map((log, index) => (
                <div key={index} className="ct-log-entry">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="ct-section">
        <h3>🔧 Debug Info</h3>
        <div style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
          <p>Master WS: {masterWs ? "✅ Connected" : "❌ Disconnected"}</p>
          <p>Exact Copy Mode: {isActive ? "🎯 Active" : "❌ Inactive"}</p>
          <p>Connected Clients: {clients.filter((c) => c.status === "connected").length}</p>
          <p>Pending Proposals: {pendingProposalsRef.current.size}</p>
          <p>Processed Contracts: {processedContractsRef.current.size}</p>
          <p>Multi-Stream Detection: ✅ Enabled</p>
          <p>Data Persistence: ✅ Enabled</p>
        </div>
      </div>

      {/* Instructions */}
      <div className="ct-section">
        <h3>📖 Fixed Issues</h3>
        <div style={{ fontSize: "0.8rem", lineHeight: "1.4" }}>
          <p>
            <strong>✅ FIXED:</strong> contract_type undefined error
          </p>
          <p>
            <strong>✅ FIXED:</strong> Negative amount error
          </p>
          <p>
            <strong>✅ FIXED:</strong> Missing duration/duration_unit
          </p>
          <p>
            <strong>✅ ADDED:</strong> Multi-stream detection (portfolio + transaction + balance)
          </p>
          <p>
            <strong>✅ ADDED:</strong> Comprehensive parameter validation
          </p>
          <p>
            <strong>✅ ADDED:</strong> Shortcode barrier extraction for digit contracts
          </p>
          <p>
            <strong>🎯 Result:</strong> Should now copy trades exactly with all required parameters!
          </p>
        </div>
      </div>

      {/* Risk Warning */}
      <div className="ct-warning">
        ⚠️ <strong>Risk Warning:</strong> Copy trading involves significant risk. Only trade with money you can afford to
        lose. Test with small amounts first!
      </div>
    </div>
  )
})

export default CopyTrading
