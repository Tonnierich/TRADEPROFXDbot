"use client"

import type React from "react"
import { useState } from "react"
import { observer } from "mobx-react-lite"
import "./copy-trading.scss"

const CopyTrading: React.FC = observer(() => {
  const [isActive, setIsActive] = useState(false)
  const [clientToken, setClientToken] = useState("")
  const [clientTokens, setClientTokens] = useState<string[]>([])
  const [masterBalance] = useState("0.00 USD") // This would come from API
  const [masterAccount] = useState("CR4859111") // This would come from API

  const handleAddToken = () => {
    if (clientToken.trim() && !clientTokens.includes(clientToken.trim())) {
      setClientTokens([...clientTokens, clientToken.trim()])
      setClientToken("")
    }
  }

  const handleRemoveToken = (tokenToRemove: string) => {
    setClientTokens(clientTokens.filter((token) => token !== tokenToRemove))
  }

  const handleStartStopCopyTrading = () => {
    if (clientTokens.length === 0) {
      alert("Please add at least one client token before starting copy trading")
      return
    }
    setIsActive(!isActive)
  }

  const handleSync = () => {
    // Sync functionality - refresh client data
    alert("Syncing client data...")
  }

  const toggleDemoReal = () => {
    // Toggle between demo and real trading
    alert("Switching between Demo and Real trading...")
  }

  return (
    <div className="copy-trading">
      {/* Header Controls */}
      <div className="copy-trading__header">
        <button
          className={`copy-trading__demo-toggle ${isActive ? "copy-trading__demo-toggle--stop" : "copy-trading__demo-toggle--start"}`}
          onClick={toggleDemoReal}
        >
          {isActive ? "Stop Demo to Real Copy Trading" : "Start Demo to Real Copy Trading"}
        </button>

        <button className="copy-trading__tutorial">📺 Tutorial</button>
      </div>

      {/* Master Account Display */}
      <div className="copy-trading__master-account">
        <div className="copy-trading__account-id">{masterAccount}</div>
        <div className="copy-trading__balance">{masterBalance}</div>
      </div>

      {/* Add Tokens Section */}
      <div className="copy-trading__add-tokens">
        <h3>Add tokens to Replicator</h3>

        <div className="copy-trading__input-section">
          <input
            type="text"
            placeholder="Enter Client token"
            value={clientToken}
            onChange={(e) => setClientToken(e.target.value)}
            className="copy-trading__token-input"
            onKeyPress={(e) => e.key === "Enter" && handleAddToken()}
          />
          <div className="copy-trading__input-buttons">
            <button className="copy-trading__add-btn" onClick={handleAddToken} disabled={!clientToken.trim()}>
              Add
            </button>
            <button className="copy-trading__sync-btn" onClick={handleSync}>
              Sync 🔄
            </button>
          </div>
        </div>

        <button
          className={`copy-trading__start-btn ${isActive ? "copy-trading__start-btn--stop" : ""}`}
          onClick={handleStartStopCopyTrading}
        >
          {isActive ? "Stop Copy Trading" : "Start Copy Trading"}
        </button>
      </div>

      {/* Client Tokens List */}
      <div className="copy-trading__clients">
        <div className="copy-trading__clients-header">
          <h3>Total Clients added: {clientTokens.length}</h3>
        </div>

        {clientTokens.length === 0 ? (
          <div className="copy-trading__no-tokens">No tokens added yet</div>
        ) : (
          <div className="copy-trading__tokens-list">
            {clientTokens.map((token, index) => (
              <div key={index} className="copy-trading__token-item">
                <div className="copy-trading__token-info">
                  <span className="copy-trading__token-id">Client {index + 1}</span>
                  <span className="copy-trading__token-value">{token}</span>
                </div>
                <div className="copy-trading__token-actions">
                  <span
                    className={`copy-trading__token-status ${isActive ? "copy-trading__token-status--active" : "copy-trading__token-status--inactive"}`}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </span>
                  <button className="copy-trading__remove-btn" onClick={() => handleRemoveToken(token)}>
                    ❌
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Indicator */}
      {isActive && (
        <div className="copy-trading__status">
          <div className="copy-trading__status-indicator">
            <span className="copy-trading__status-dot"></span>
            Copy Trading Active - Replicating trades to {clientTokens.length} client
            {clientTokens.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Risk Disclaimer */}
      <div className="copy-trading__disclaimer">⚠️ Risk Disclaimer</div>
    </div>
  )
})

export default CopyTrading
