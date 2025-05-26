"use client"

import React, { lazy, Suspense, useEffect, useState } from "react"
import classNames from "classnames"
import { observer } from "mobx-react-lite"
import { useLocation, useNavigate } from "react-router-dom"
import ChunkLoader from "@/components/loader/chunk-loader"
import { generateOAuthURL } from "@/components/shared"
import DesktopWrapper from "@/components/shared_ui/desktop-wrapper"
import Dialog from "@/components/shared_ui/dialog"
import MobileWrapper from "@/components/shared_ui/mobile-wrapper"
import Tabs from "@/components/shared_ui/tabs/tabs"
import TradingViewModal from "@/components/trading-view-chart/trading-view-modal"
import { DBOT_TABS, TAB_IDS } from "@/constants/bot-contents"
import { api_base, updateWorkspaceName } from "@/external/bot-skeleton"
import { CONNECTION_STATUS } from "@/external/bot-skeleton/services/api/observables/connection-status-stream"
import { isDbotRTL } from "@/external/bot-skeleton/utils/workspace"
import { useOauth2 } from "@/hooks/auth/useOauth2"
import { useApiBase } from "@/hooks/useApiBase"
import { useStore } from "@/hooks/useStore"
import {
  LabelPairedChartLineCaptionRegularIcon,
  LabelPairedObjectsColumnCaptionRegularIcon,
  LabelPairedPuzzlePieceTwoCaptionBoldIcon,
} from "@deriv/quill-icons/LabelPaired"
import { LegacyGuide1pxIcon, LegacyIndicatorsIcon, LegacyTemplatesIcon } from "@deriv/quill-icons/Legacy"
import { requestOidcAuthentication } from "@deriv-com/auth-client"
import { Localize, localize } from "@deriv-com/translations"
import { useDevice } from "@deriv-com/ui"
import RunPanel from "../../components/run-panel"
import ChartModal from "../chart/chart-modal"
import Dashboard from "../dashboard"
import RunStrategy from "../dashboard/run-strategy"
import Strategies from "../strategies/strategies"
import "./main.scss"

const ChartWrapper = lazy(() => import("../chart/chart-wrapper"))
const Tutorial = lazy(() => import("../tutorials"))
const Analysis = lazy(() => import("../analysis/analysis"))
const FreeBots = lazy(() => import("../free-bots/free-bots")) // ONLY CHANGE: Import the correct FreeBots component

// Declare Blockly
declare var Blockly: any

const AppWrapper = observer(() => {
  const { connectionStatus } = useApiBase()
  const { dashboard, load_modal, run_panel, quick_strategy, summary_card, client } = useStore()
  const {
    active_tab,
    active_tour,
    is_chart_modal_visible,
    is_trading_view_modal_visible,
    setActiveTab,
    setWebSocketState,
    setActiveTour,
    setTourDialogVisibility,
  } = dashboard
  const { dashboard_strategies } = load_modal
  const {
    is_dialog_open,
    is_drawer_open,
    dialog_options,
    onCancelButtonClick,
    onCloseDialog,
    onOkButtonClick,
    stopBot,
  } = run_panel
  const { is_open } = quick_strategy
  const { clear } = summary_card
  const { DASHBOARD, BOT_BUILDER, CHART, TUTORIAL, ANALYSIS, STRATEGIES, FREE_BOTS } = DBOT_TABS // Add FREE_BOTS
  const init_render = React.useRef(true)
  const hash = ["dashboard", "bot_builder", "chart", "tutorial", "analysis", "strategies", "free-bots"] // Add free-bots
  const { isDesktop } = useDevice()
  const location = useLocation()
  const navigate = useNavigate()
  const [left_tab_shadow, setLeftTabShadow] = useState<boolean>(false)
  const [right_tab_shadow, setRightTabShadow] = useState<boolean>(false)

  // Force all tabs to be visible
  useEffect(() => {
    // This ensures the Analysis Tools and Strategies tabs are always visible
    if (typeof window !== "undefined") {
      window.localStorage.setItem("show_analysis_tools", "true")
      window.localStorage.setItem("show_strategies", "true")
      window.localStorage.setItem("show_free_bots", "true") // Add Free Bots visibility
      ;(window as any).SHOW_ALL_DBOT_TABS = true
    }
  }, [])

  // Add effect to hide SmartTrader, Deriv Trader, and Traders Hub
  useEffect(() => {
    // Create a style element to inject CSS
    const style = document.createElement("style")
    style.innerHTML = `
      /* Hide platform switcher and Trader's Hub elements */
      .platform-switcher,
      .platform-dropdown,
      .traders-hub-link,
      .platform-switcher__dropdown,
      [data-testid="dt_platform_switcher"],
      [data-testid="dt_traders_hub_link"],
      .app-header__traders-hub,
      .app-header__platform-switcher,
      .platform-switcher__list,
      .platform-switcher__list-item,
      .platform-switcher__button,
      a[href*="smarttrader"],
      a[href*="trader"],
      a[href*="traders-hub"],
      a[href*="derivtrader"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `
    document.head.appendChild(style)

    // Also try to remove elements directly
    const removeElements = () => {
      const selectors = [
        ".platform-switcher",
        ".traders-hub-link",
        '[data-testid="dt_platform_switcher"]',
        '[data-testid="dt_traders_hub_link"]',
        ".app-header__traders-hub",
        ".app-header__platform-switcher",
      ]

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector)
        elements.forEach((el) => {
          if (el && el.parentNode) {
            el.parentNode.removeChild(el)
          }
        })
      })
    }

    // Run immediately and then periodically to catch dynamically added elements
    removeElements()
    const interval = setInterval(removeElements, 1000)

    return () => {
      document.head.removeChild(style)
      clearInterval(interval)
    }
  }, [])

  let tab_value: number | string = active_tab
  const GetHashedValue = (tab: number) => {
    tab_value = location.hash?.split("#")[1]
    if (!tab_value) return tab
    return Number(hash.indexOf(String(tab_value)))
  }
  const active_hash_tab = GetHashedValue(active_tab)

  React.useEffect(() => {
    const el_dashboard = document.getElementById("id-dbot-dashboard")
    const el_tutorial = document.getElementById("id-tutorials")

    if (el_dashboard && el_tutorial) {
      const observer_dashboard = new window.IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setLeftTabShadow(false)
            return
          }
          setLeftTabShadow(true)
        },
        {
          root: null,
          threshold: 0.5, // set offset 0.1 means trigger if atleast 10% of element in viewport
        },
      )

      const observer_tutorial = new window.IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setRightTabShadow(false)
            return
          }
          setRightTabShadow(true)
        },
        {
          root: null,
          threshold: 0.5, // set offset 0.1 means trigger if atleast 10% of element in viewport
        },
      )

      observer_dashboard.observe(el_dashboard)
      observer_tutorial.observe(el_tutorial)

      return () => {
        observer_dashboard.unobserve(el_dashboard)
        observer_tutorial.unobserve(el_tutorial)
      }
    }
  }, [])

  React.useEffect(() => {
    if (connectionStatus !== CONNECTION_STATUS.OPENED) {
      const is_bot_running = document.getElementById("db-animation__stop-button") !== null
      if (is_bot_running) {
        clear()
        stopBot()
        api_base.setIsRunning(false)
        setWebSocketState(false)
      }
    }
  }, [clear, connectionStatus, setWebSocketState, stopBot])

  // Update tab shadows height to match bot builder height
  const updateTabShadowsHeight = () => {
    const botBuilderEl = document.getElementById("id-bot-builder")
    const leftShadow = document.querySelector(".tabs-shadow--left") as HTMLElement
    const rightShadow = document.querySelector(".tabs-shadow--right") as HTMLElement

    if (botBuilderEl && leftShadow && rightShadow) {
      const height = botBuilderEl.offsetHeight
      leftShadow.style.height = `${height}px`
      rightShadow.style.height = `${height}px`
    }
  }

  React.useEffect(() => {
    // Run on mount and when active tab changes
    updateTabShadowsHeight()

    // ALWAYS ensure tabs are visible, especially after login
    if (typeof window !== "undefined") {
      // Force all tabs to be visible by setting localStorage flags
      localStorage.setItem("show_analysis_tools", "true")
      localStorage.setItem("show_strategies", "true")
      localStorage.setItem("show_free_bots", "true") // Add Free Bots visibility

      // Add a global flag to indicate these tabs should be visible
      ;(window as any).SHOW_ALL_DBOT_TABS = true

      console.log("Ensuring all tabs are visible after potential login")
    }

    if (is_open) {
      setTourDialogVisibility(false)
    }

    if (init_render.current) {
      setActiveTab(Number(active_hash_tab))
      if (!isDesktop) handleTabChange(Number(active_hash_tab))
      init_render.current = false
    } else {
      navigate(`#${hash[active_tab] || hash[0]}`)
    }
    if (active_tour !== "") {
      setActiveTour("")
    }

    // Prevent scrolling when tutorial tab is active (only on mobile)
    const mainElement = document.querySelector(".main__container")
    if (active_tab === TUTORIAL && !isDesktop) {
      document.body.style.overflow = "hidden"
      if (mainElement instanceof HTMLElement) {
        mainElement.classList.add("no-scroll")
      }
    } else {
      document.body.style.overflow = ""
      if (mainElement instanceof HTMLElement) {
        mainElement.classList.remove("no-scroll")
      }
    }
  }, [active_tab])

  // Add this new useEffect to monitor login state changes
  React.useEffect(() => {
    // Check if user just logged in by looking at the client object
    const isLoggedIn = !!client?.loginid

    if (isLoggedIn) {
      console.log("User logged in, ensuring tabs are visible")
      // Force all tabs to be visible
      if (typeof window !== "undefined") {
        localStorage.setItem("show_analysis_tools", "true")
        localStorage.setItem("show_strategies", "true")
        localStorage.setItem("show_free_bots", "true") // Add Free Bots visibility
        ;(window as any).SHOW_ALL_DBOT_TABS = true

        // Force a re-render of the tabs
        const tabsContainer = document.querySelector(".main__tabs")
        if (tabsContainer) {
          // This is a hack to force a re-render
          tabsContainer.classList.add("force-update")
          setTimeout(() => {
            tabsContainer.classList.remove("force-update")
          }, 10)
        }
      }
    }
  }, [client?.loginid])

  React.useEffect(() => {
    const trashcan_init_id = setTimeout(() => {
      if (active_tab === BOT_BUILDER && Blockly?.derivWorkspace?.trashcan) {
        const trashcanY = window.innerHeight - 250
        let trashcanX
        if (is_drawer_open) {
          trashcanX = isDbotRTL() ? 380 : window.innerWidth - 460
        } else {
          trashcanX = isDbotRTL() ? 20 : window.innerWidth - 100
        }
        Blockly?.derivWorkspace?.trashcan?.setTrashcanPosition(trashcanX, trashcanY)
      }
    }, 100)

    return () => {
      clearTimeout(trashcan_init_id) // Clear the timeout on unmount
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active_tab, is_drawer_open])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (dashboard_strategies.length > 0) {
      // Needed to pass this to the Callback Queue as on tab changes
      // document title getting override by 'Bot | Deriv' only
      timer = setTimeout(() => {
        updateWorkspaceName()
      })
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [dashboard_strategies, active_tab])

  const handleTabChange = React.useCallback(
    (tab_index: number) => {
      setActiveTab(tab_index)
      const el_id = TAB_IDS[tab_index]
      if (el_id) {
        const el_tab = document.getElementById(el_id)
        setTimeout(() => {
          el_tab?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
        }, 10)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active_tab],
  )

  const { isOAuth2Enabled } = useOauth2()
  const handleLoginGeneration = async () => {
    if (!isOAuth2Enabled) {
      window.location.replace(generateOAuthURL())
    } else {
      const getQueryParams = new URLSearchParams(window.location.search)
      const currency = getQueryParams.get("account") ?? ""
      const query_param_currency = sessionStorage.getItem("query_param_currency") || currency || "USD"
      try {
        await requestOidcAuthentication({
          redirectCallbackUri: `${window.location.origin}/callback`,
          ...(query_param_currency
            ? {
                state: {
                  account: query_param_currency,
                },
              }
            : {}),
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error(err)
        })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error)
      }
    }
  }

  // Make dashboard available globally for the Strategies component
  if (typeof window !== "undefined") {
    window.dashboard = {
      setActiveTab: setActiveTab,
    }
  }

  return (
    <React.Fragment>
      <div className="main">
        <div
          className={classNames("main__container", {
            "main__container--active": active_tour && active_tab === DASHBOARD && !isDesktop,
          })}
        >
          <div>
            {!isDesktop && left_tab_shadow && <span className="tabs-shadow tabs-shadow--left" />}{" "}
            <Tabs active_index={active_tab} className="main__tabs" onTabItemClick={handleTabChange} top>
              <div
                label={
                  <>
                    <LabelPairedObjectsColumnCaptionRegularIcon height="24px" width="24px" fill="var(--text-general)" />
                    <Localize i18n_default_text="Dashboard" />
                  </>
                }
                id="id-dbot-dashboard"
              >
                <Dashboard handleTabChange={handleTabChange} />
              </div>
              <div
                label={
                  <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height="24px" width="24px" fill="var(--text-general)" />
                    <Localize i18n_default_text="Bot Builder" />
                  </>
                }
                id="id-bot-builder"
              ></div>
              <div
                label={
                  <>
                    <LabelPairedChartLineCaptionRegularIcon height="24px" width="24px" fill="var(--text-general)" />
                    <Localize i18n_default_text="Charts" />
                  </>
                }
                id={is_chart_modal_visible || is_trading_view_modal_visible ? "id-charts--disabled" : "id-charts"}
              >
                <Suspense fallback={<ChunkLoader message={localize("Please wait, loading chart...")} />}>
                  <ChartWrapper show_digits_stats={false} />
                </Suspense>
              </div>
              <div
                label={
                  <>
                    <LegacyGuide1pxIcon
                      height="16px"
                      width="16px"
                      fill="var(--text-general)"
                      className="icon-general-fill-g-path"
                    />
                    <Localize i18n_default_text="Tutorials" />
                  </>
                }
                id="id-tutorials"
              >
                <div className="tutorials-wrapper">
                  <Suspense fallback={<ChunkLoader message={localize("Please wait, loading tutorials...")} />}>
                    <Tutorial handleTabChange={handleTabChange} />
                  </Suspense>
                </div>
              </div>
              {/* Analysis Tab */}
              <div
                label={
                  <>
                    <LegacyIndicatorsIcon
                      height="16px"
                      width="16px"
                      fill="var(--text-general)"
                      className="icon-general-fill-g-path"
                    />
                    <Localize i18n_default_text="Analysis" />
                  </>
                }
                id="id-analysis"
              >
                <Suspense fallback={<ChunkLoader message={localize("Please wait, loading analysis tool...")} />}>
                  <Analysis />
                </Suspense>
              </div>
              {/* Strategies Tab */}
              <div
                label={
                  <>
                    <LegacyTemplatesIcon
                      height="16px"
                      width="16px"
                      fill="var(--text-general)"
                      className="icon-general-fill-g-path"
                    />
                    <Localize i18n_default_text="Strategies" />
                  </>
                }
                id="id-strategies"
              >
                <Strategies />
              </div>
              {/* Free Bots Tab */}
              <div
                label={
                  <>
                    <LabelPairedPuzzlePieceTwoCaptionBoldIcon height="24px" width="24px" fill="var(--text-general)" />
                    <Localize i18n_default_text="Free Bots" />
                  </>
                }
                id="id-free-bots"
              >
                <Suspense fallback={<ChunkLoader message={localize("Please wait, loading free bots...")} />}>
                  <FreeBots />
                </Suspense>
              </div>
            </Tabs>
            {!isDesktop && right_tab_shadow && <span className="tabs-shadow tabs-shadow--right" />}{" "}
          </div>
        </div>
      </div>
      <DesktopWrapper>
        <div className="main__run-strategy-wrapper">
          <RunStrategy />
          <RunPanel />
        </div>
        <ChartModal />
        <TradingViewModal />
      </DesktopWrapper>
      <MobileWrapper>{!is_open && <RunPanel />}</MobileWrapper>
      <Dialog
        cancel_button_text={dialog_options?.cancel_button_text || localize("Cancel")}
        className="dc-dialog__wrapper--fixed"
        confirm_button_text={dialog_options?.ok_button_text || localize("Ok")}
        has_close_icon
        is_mobile_full_width={false}
        is_visible={is_dialog_open}
        onCancel={onCancelButtonClick}
        onClose={onCloseDialog}
        onConfirm={onOkButtonClick || onCloseDialog}
        portal_element_id="modal_root"
        title={dialog_options?.title}
        login={handleLoginGeneration}
        dismissable={dialog_options?.dismissable} // Prevents closing on outside clicks
        is_closed_on_cancel={dialog_options?.is_closed_on_cancel}
      >
        {dialog_options?.message}
      </Dialog>
    </React.Fragment>
  )
})

export default AppWrapper

