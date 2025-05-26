import { action, makeObservable, observable, runInAction } from "mobx"
import type RootStore from "./root-store"

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

export default class CopyTradingStore {
  root_store: RootStore

  // Observable state
  is_connected = false
  is_loading = false
  error_message: string | null = null
  success_message: string | null = null

  // Trader state
  allow_copiers = false
  my_stats: TraderStats | null = null

  // Copier state
  copying_sessions: CopyingSession[] = []
  trader_stats: TraderStats | null = null

  // WebSocket connection
  ws: WebSocket | null = null

  constructor(root_store: RootStore) {
    makeObservable(this, {
      is_connected: observable,
      is_loading: observable,
      error_message: observable,
      success_message: observable,
      allow_copiers: observable,
      my_stats: observable,
      copying_sessions: observable,
      trader_stats: observable,

      // Actions
      connectToAPI: action.bound,
      disconnectFromAPI: action.bound,
      enableCopyTrading: action.bound,
      startCopying: action.bound,
      stopCopying: action.bound,
      loadTraderStats: action.bound,
      loadMyStats: action.bound,
      loadCopyingSessions: action.bound,
      setError: action.bound,
      setSuccess: action.bound,
      clearMessages: action.bound,
    })

    this.root_store = root_store
  }

  connectToAPI() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return // Already connected
    }

    this.ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")

    this.ws.onopen = () => {
      runInAction(() => {
        this.is_connected = true
        this.setSuccess("Connected to Deriv API")
      })
    }

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      this.handleApiResponse(data)
    }

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error)
      runInAction(() => {
        this.setError("Failed to connect to Deriv API")
      })
    }

    this.ws.onclose = () => {
      runInAction(() => {
        this.is_connected = false
        this.ws = null
      })
    }
  }

  disconnectFromAPI() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.is_connected = false
    }
  }

  private handleApiResponse(data: any) {
    runInAction(() => {
      this.is_loading = false

      if (data.error) {
        this.setError(data.error.message)
        return
      }

      switch (data.msg_type) {
        case "set_settings":
          if (data.set_settings === 1) {
            this.setSuccess("Copy trading settings updated successfully!")
            this.allow_copiers = data.echo_req.allow_copiers === 1
          }
          break

        case "copytrading_statistics":
          if (data.echo_req.trader_id) {
            this.trader_stats = data.copytrading_statistics
          } else {
            this.my_stats = data.copytrading_statistics
          }
          break

        case "copy_start":
          if (data.copy_start === 1) {
            this.setSuccess("Started copying trader successfully!")
            this.loadCopyingSessions()
          }
          break

        case "copy_stop":
          if (data.copy_stop === 1) {
            this.setSuccess("Stopped copying trader successfully!")
            this.loadCopyingSessions()
          }
          break

        case "copytrading_list":
          this.copying_sessions = data.copytrading_list || []
          break
      }
    })
  }

  private sendApiRequest(request: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(request))
      this.is_loading = true
      this.clearMessages()
    } else {
      this.setError("Not connected to Deriv API")
    }
  }

  enableCopyTrading(apiToken: string, allowCopiers: boolean) {
    this.sendApiRequest({
      set_settings: 1,
      allow_copiers: allowCopiers ? 1 : 0,
      authorize: apiToken,
    })
  }

  startCopying(traderToken: string, apiToken: string) {
    this.sendApiRequest({
      copy_start: 1,
      copy_start: traderToken,
      authorize: apiToken,
    })
  }

  stopCopying(traderToken: string, apiToken: string) {
    this.sendApiRequest({
      copy_stop: 1,
      copy_stop: traderToken,
      authorize: apiToken,
    })
  }

  loadTraderStats(traderToken: string) {
    this.sendApiRequest({
      copytrading_statistics: 1,
      trader_id: traderToken,
    })
  }

  loadMyStats(apiToken: string) {
    this.sendApiRequest({
      copytrading_statistics: 1,
      authorize: apiToken,
    })
  }

  loadCopyingSessions(apiToken: string) {
    this.sendApiRequest({
      copytrading_list: 1,
      authorize: apiToken,
    })
  }

  setError(message: string) {
    this.error_message = message
    this.success_message = null
  }

  setSuccess(message: string) {
    this.success_message = message
    this.error_message = null
  }

  clearMessages() {
    this.error_message = null
    this.success_message = null
  }
}
