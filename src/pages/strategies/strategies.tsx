"use client"

import { observer } from "mobx-react-lite"
import { Localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import { useEffect, useState } from "react"
import "./strategies.scss"

// Define the bot data structure
interface BotStrategy {
  id: string
  name: string
  description: string
  difficulty: string
  winRate: string
  riskLevel: string
  category: string
  xmlUrl: string
  xmlContent: string
}

// Utility functions integrated directly into the component
const fetchXmlFromUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch XML: ${response.status} ${response.statusText}`)
    }
    return await response.text()
  } catch (error) {
    console.error("Error fetching XML:", error)
    throw error
  }
}

const isValidDerivBotXml = (xmlContent: string): boolean => {
  try {
    // Check if it has the basic structure of a Deriv bot
    return (
      xmlContent.includes('is_dbot="true"') &&
      (xmlContent.includes('<block type="trade_definition"') ||
        xmlContent.includes('<block type="before_purchase"') ||
        xmlContent.includes('<block type="after_purchase"'))
    )
  } catch (error) {
    console.error("Error validating XML:", error)
    return false
  }
}

const loadBotXmlToWorkspace = (xmlContent: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Check if Blockly is available
      if (!window.Blockly || !window.Blockly.derivWorkspace) {
        throw new Error("Bot Builder workspace is not available")
      }

      // Clear the current workspace
      window.Blockly.derivWorkspace.clear()

      // Load the XML into the workspace
      const xml = window.Blockly.Xml.textToDom(xmlContent)
      window.Blockly.Xml.domToWorkspace(xml, window.Blockly.derivWorkspace)

      // Switch to the Bot Builder tab
      const botBuilderTabIndex = 1 // This is the index of the Bot Builder tab
      
      // Try to use the dashboard store to switch tabs
      if (window.dashboard && typeof window.dashboard.setActiveTab === "function") {
        window.dashboard.setActiveTab(botBuilderTabIndex)
      } else {
        // Fallback method to switch tabs
        const botBuilderTab = document.getElementById("id-bot-builder")
        if (botBuilderTab) {
          const clickEvent = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          })
          botBuilderTab.dispatchEvent(clickEvent)
        }
      }

      resolve()
    } catch (error) {
      console.error("Error loading bot XML:", error)
      reject(error)
    }
  })
}

// Declare Blockly for TypeScript
declare global {
  interface Window {
    Blockly?: {
      derivWorkspace: {
        clear: () => void
        trashcan?: {
          setTrashcanPosition: (x: number, y: number) => void
        }
      }
      Xml: {
        textToDom: (xmlText: string) => Document
        domToWorkspace: (dom: Document, workspace: any) => void
      }
    }
    dashboard?: {
      setActiveTab: (index: number) => void
    }
  }
}

const Strategies = observer(() => {
  const { isDesktop } = useDevice()
  const [botStrategies, setBotStrategies] = useState<BotStrategy[]>([
    {
      id: "double-even-odd-picker",
      name: "TRADEPROFX DOUBLE EVEN/ODD PICKER",
      description: "A strategy that picks even or odd digits based on pattern recognition.",
      difficulty: "Intermediate",
      winRate: "75%",
      riskLevel: "Medium",
      category: "Digits",
      xmlUrl:
        "https://blobs.vusercontent.net/blob/TRADEPROFX%20DOUBLE%20EVEN_ODD%20PICKER%2075%281s%29-05iPEC2yyv3qI46oihiOnSl7D7I0DA.xml",
      xmlContent: "",
    },
    {
      id: "even-odd-double-safety",
      name: "Even Odd Double Safety",
      description: "A strategy with double safety mechanisms for even/odd digit trading.",
      difficulty: "Advanced",
      winRate: "70%",
      riskLevel: "Medium-High",
      category: "Digits",
      xmlUrl: "https://blobs.vusercontent.net/blob/even%20odd%20double%20safety-sAtj2JfYVyf3Ty9LBc72ACPYDA5xcg.xml",
      xmlContent: "",
    },
    {
      id: "joseph-weaver-free-even-odd",
      name: "Joseph Weaver Free Even Odd Bot",
      description: "A free even/odd strategy bot with smart entry mechanisms.",
      difficulty: "Beginner",
      winRate: "68%",
      riskLevel: "Low",
      category: "Digits",
      xmlUrl:
        "https://blobs.vusercontent.net/blob/Joseph%20Weaver%20Free%20Even%20Odd%20Bot%20%28inbox%20for%20the%20PRO%20V%29-bWbAra52bghA0fiA41mspdlhHRFpBF.xml",
      xmlContent: "",
    },
  ])
  const [isLoading, setIsLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // Load the XML content for each bot
  useEffect(() => {
    const loadXmlContent = async () => {
      setIsLoading(true)
      setLoadingError(null)

      try {
        const updatedStrategies = [...botStrategies]
        const loadPromises = updatedStrategies.map(async (strategy) => {
          try {
            // Try to get from localStorage first
            const cachedXml = localStorage.getItem(`bot_xml_${strategy.id}`)

            if (cachedXml && isValidDerivBotXml(cachedXml)) {
              strategy.xmlContent = cachedXml
            } else {
              // If not in localStorage or invalid, fetch from URL
              const xmlContent = await fetchXmlFromUrl(strategy.xmlUrl)
              if (isValidDerivBotXml(xmlContent)) {
                strategy.xmlContent = xmlContent
                // Cache it for future use
                localStorage.setItem(`bot_xml_${strategy.id}`, xmlContent)
              } else {
                console.error(`Invalid XML content for bot ${strategy.id}`)
              }
            }
          } catch (error) {
            console.error(`Error loading XML for bot ${strategy.id}:`, error)
          }
        })

        await Promise.all(loadPromises)
        setBotStrategies(updatedStrategies)
      } catch (error) {
        console.error("Error loading bot strategies:", error)
        setLoadingError("Failed to load bot strategies. Please try again later.")
      } finally {
        setIsLoading(false)
      }
    }

    loadXmlContent()
  }, [])

  // Function to load a bot into the Bot Builder
  const loadBotToBuilder = async (botId: string, botXml: string) => {
    try {
      // Show loading notification
      const loadingNotification = document.createElement("div")
      loadingNotification.className = "strategies__notification strategies__notification--loading"
      loadingNotification.textContent = "Loading bot into Bot Builder..."
      document.body.appendChild(loadingNotification)

      // Load the bot into the workspace
      await loadBotXmlToWorkspace(botXml)

      // Remove loading notification
      document.body.removeChild(loadingNotification)

      // Show success notification
      const successNotification = document.createElement("div")
      successNotification.className = "strategies__notification strategies__notification--success"
      successNotification.textContent = `Bot loaded successfully into the Bot Builder!`
      document.body.appendChild(successNotification)

      // Remove success notification after 3 seconds
      setTimeout(() => {
        successNotification.classList.add("strategies__notification--fade-out")
        setTimeout(() => {
          document.body.removeChild(successNotification)
        }, 500)
      }, 3000)
    } catch (error) {
      console.error("Error loading bot:", error)

      // Show error notification
      const errorNotification = document.createElement("div")
      errorNotification.className = "strategies__notification strategies__notification--error"
      errorNotification.textContent = "Failed to load bot. Please try again."
      document.body.appendChild(errorNotification)

      // Remove error notification after 3 seconds
      setTimeout(() => {
        errorNotification.classList.add("strategies__notification--fade-out")
        setTimeout(() => {
          document.body.removeChild(errorNotification)
        }, 500)
      }, 3000)
    }
  }

  return (
    <div className="strategies">
      <div className="strategies__header">
        <h2 className="strategies__title">
          <Localize i18n_default_text="Trading Strategies" />
        </h2>
        <p className="strategies__description">
          <Localize i18n_default_text="Explore and implement proven trading strategies to enhance your automated trading experience." />
        </p>
      </div>
      <div className="strategies__content">
        {isLoading ? (
          <div className="strategies__loading">
            <Localize i18n_default_text="Loading strategies..." />
          </div>
        ) : loadingError ? (
          <div className="strategies__error">
            <Localize i18n_default_text={loadingError} />
          </div>
        ) : (
          <div className="strategies__section">
            <h3 className="strategies__section-title">
              <Localize i18n_default_text="Even/Odd Digit Strategies" />
            </h3>
            <div className="strategies__grid">
              {botStrategies.map((strategy) => (
                <div key={strategy.id} className="strategies__card">
                  <div className="strategies__card-header">
                    <h4 className="strategies__card-title">
                      <Localize i18n_default_text={strategy.name} />
                    </h4>
                    <span className={`strategies__card-tag strategies__card-tag--${strategy.difficulty.toLowerCase()}`}>
                      <Localize i18n_default_text={strategy.difficulty} />
                    </span>
                  </div>
                  <div className="strategies__card-content">
                    <p>
                      <Localize i18n_default_text={strategy.description} />
                    </p>
                    <div className="strategies__card-stats">
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Win Rate" />
                        </span>
                        <span className="strategies__card-stat-value">{strategy.winRate}</span>
                      </div>
                      <div className="strategies__card-stat">
                        <span className="strategies__card-stat-label">
                          <Localize i18n_default_text="Risk Level" />
                        </span>
                        <span className="strategies__card-stat-value">{strategy.riskLevel}</span>
                      </div>
                    </div>
                    <button
                      className="strategies__button"
                      onClick={() => loadBotToBuilder(strategy.id, strategy.xmlContent)}
                      disabled={!strategy.xmlContent}
                    >
                      <Localize i18n_default_text={strategy.xmlContent ? "Load Strategy" : "Loading..."} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default Strategies