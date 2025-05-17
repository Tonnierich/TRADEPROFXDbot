"use client"

import React from "react"

import clsx from "clsx"
import { observer } from "mobx-react-lite"
import { standalone_routes, generateOAuthURL } from "@/components/shared" // Added generateOAuthURL import
import Button from "@/components/shared_ui/button"
import useActiveAccount from "@/hooks/api/account/useActiveAccount"
import { useOauth2 } from "@/hooks/auth/useOauth2"
import useGrowthbookGetFeatureValue from "@/hooks/growthbook/useGrowthbookGetFeatureValue"
import { useApiBase } from "@/hooks/useApiBase"
import { useStore } from "@/hooks/useStore"
import { StandaloneCircleUserRegularIcon } from "@deriv/quill-icons/Standalone"
// Removed requestOidcAuthentication import
// import { requestOidcAuthentication } from '@deriv-com/auth-client';
import { Localize, useTranslations } from "@deriv-com/translations"
import { Header, useDevice, Wrapper } from "@deriv-com/ui"
import { Tooltip } from "@deriv-com/ui"
import { AppLogo } from "../app-logo"
import AccountsInfoLoader from "./account-info-loader"
import AccountSwitcher from "./account-switcher"
// Removed MenuItems import to hide Traders Hub link
// import MenuItems from './menu-items';
import MobileMenu from "./mobile-menu"
// Removed PlatformSwitcher import to hide platform switcher
// import PlatformSwitcher from './platform-switcher';
import "./header.scss"

// Add CSS to hide platform switcher and traders hub elements
const hideTraderHubStyle = document.createElement("style")
hideTraderHubStyle.innerHTML = `
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
document.head.appendChild(hideTraderHubStyle)

const AppHeader = observer(() => {
  const { isDesktop } = useDevice()
  const { isAuthorizing, activeLoginid } = useApiBase()
  const { client } = useStore() ?? {}

  const { data: activeAccount } = useActiveAccount({ allBalanceData: client?.all_accounts_balance })
  const { accounts, getCurrency } = client ?? {}
  const has_wallet = Object.keys(accounts ?? {}).some((id) => accounts?.[id].account_category === "wallet")

  const currency = getCurrency?.()
  const { localize } = useTranslations()

  const { isSingleLoggingIn } = useOauth2()

  const { featureFlagValue } = useGrowthbookGetFeatureValue<any>({ featureFlag: "hub_enabled_country_list" })

  // Effect to periodically remove platform switcher and traders hub elements
  React.useEffect(() => {
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

    return () => clearInterval(interval)
  }, [])

  const renderAccountSection = () => {
    if (isAuthorizing || isSingleLoggingIn) {
      return <AccountsInfoLoader isLoggedIn isMobile={!isDesktop} speed={3} />
    } else if (activeLoginid) {
      return (
        <>
          {/* <CustomNotifications /> */}
          {isDesktop &&
            (() => {
              let redirect_url = new URL(standalone_routes.personal_details)
              const is_hub_enabled_country = featureFlagValue?.hub_enabled_country_list?.includes(client?.residence)

              if (has_wallet && is_hub_enabled_country) {
                redirect_url = new URL(standalone_routes.account_settings)
              }
              // Check if the account is a demo account
              // Use the URL parameter to determine if it's a demo account, as this will update when the account changes
              const urlParams = new URLSearchParams(window.location.search)
              const account_param = urlParams.get("account")
              const is_virtual = client?.is_virtual || account_param === "demo"

              if (is_virtual) {
                // For demo accounts, set the account parameter to 'demo'
                redirect_url.searchParams.set("account", "demo")
              } else if (currency) {
                // For real accounts, set the account parameter to the currency
                redirect_url.searchParams.set("account", currency)
              }
              return (
                <Tooltip
                  as="a"
                  href={redirect_url.toString()}
                  tooltipContent={localize("Manage account settings")}
                  tooltipPosition="bottom"
                  className="app-header__account-settings"
                >
                  <StandaloneCircleUserRegularIcon className="app-header__profile_icon" />
                </Tooltip>
              )
            })()}
          <AccountSwitcher activeAccount={activeAccount} />
          {isDesktop &&
            (has_wallet ? (
              <Button
                className="manage-funds-button"
                has_effect
                text={localize("Manage funds")}
                onClick={() => {
                  let redirect_url = new URL(standalone_routes.wallets_transfer)
                  const is_hub_enabled_country = featureFlagValue?.hub_enabled_country_list?.includes(client?.residence)
                  if (is_hub_enabled_country) {
                    redirect_url = new URL(standalone_routes.recent_transactions)
                  }
                  if (currency) {
                    redirect_url.searchParams.set("account", currency)
                  }
                  window.location.assign(redirect_url.toString())
                }}
                primary
              />
            ) : (
              <Button
                primary
                onClick={() => {
                  const redirect_url = new URL(standalone_routes.cashier_deposit)
                  if (currency) {
                    redirect_url.searchParams.set("account", currency)
                  }
                  window.location.assign(redirect_url.toString())
                }}
                className="deposit-button"
              >
                {localize("Deposit")}
              </Button>
            ))}
        </>
      )
    } else {
      return (
        <div className="auth-actions">
          <Button
            tertiary
            onClick={() => {
              const getQueryParams = new URLSearchParams(window.location.search)
              const currency = getQueryParams.get("account") ?? ""
              const query_param_currency = sessionStorage.getItem("query_param_currency") || currency || "USD"

              // Store the currency in session storage before redirecting
              if (query_param_currency) {
                sessionStorage.setItem("query_param_currency", query_param_currency)
              }

              try {
                // Log the OAuth URL for debugging
                console.log("Redirecting to OAuth URL:", generateOAuthURL())

                // Redirect to the custom OAuth URL
                window.location.replace(generateOAuthURL())
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error("Error redirecting to OAuth URL:", error)
              }
            }}
          >
            <Localize i18n_default_text="Log in" />
          </Button>
          <Button
            primary
            onClick={() => {
              window.open(standalone_routes.signup)
            }}
          >
            <Localize i18n_default_text="Sign up" />
          </Button>
        </div>
      )
    }
  }

  if (client?.should_hide_header) return null

  return (
    <Header
      className={clsx("app-header", {
        "app-header--desktop": isDesktop,
        "app-header--mobile": !isDesktop,
      })}
    >
      <Wrapper variant="left">
        <AppLogo />
        <MobileMenu />
        {/* Removed Traders Hub Link */}
        {/* Removed Platform Switcher */}
        {/* Removed Menu Items */}
      </Wrapper>
      <Wrapper variant="right">{renderAccountSection()}</Wrapper>
    </Header>
  )
})

export default AppHeader
