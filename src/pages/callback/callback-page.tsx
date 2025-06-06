import Cookies from 'js-cookie';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '@/components/shared';
import { generateDerivApiInstance } from '@/external/bot-skeleton/services/api/appId';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import { clearAuthData } from '@/utils/auth-utils';
import { Callback } from '@deriv-com/auth-client';
import { Button } from '@deriv-com/ui';
import { useEffect, useState } from 'react';

/**
 * Gets the selected currency or falls back to appropriate defaults
 */
const getSelectedCurrency = (
    tokens: Record<string, string>,
    clientAccounts: Record<string, any>,
    state: any
): string => {
    const getQueryParams = new URLSearchParams(window.location.search);
    const currency =
        (state && state?.account) ||
        getQueryParams.get('account') ||
        sessionStorage.getItem('query_param_currency') ||
        '';
    const firstAccountKey = tokens.acct1;
    const firstAccountCurrency = clientAccounts[firstAccountKey]?.currency || null;

    const validCurrencies = [...fiat_currencies_display_order, ...crypto_currencies_display_order];
    return currency && validCurrencies.includes(currency.toUpperCase())
        ? currency
        : firstAccountCurrency || (tokens.acct1?.startsWith('VR') ? 'demo' : 'USD');
};

const CallbackPage = () => {
    const [error, setError] = useState<string | null>(null);

    // Log any errors in the URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (errorParam) {
            console.error('OAuth Error:', errorParam, errorDescription);
            setError(`${errorParam}: ${errorDescription}`);
        }
    }, []);

    if (error) {
        return (
            <div className="error-container">
                <h2>Authentication Error</h2>
                <p>{error}</p>
                <Button
                    className='callback-return-button'
                    onClick={() => {
                        window.location.href = '/';
                    }}
                >
                    Return to Bot
                </Button>
            </div>
        );
    }

    return (
        <Callback
            onSignInSuccess={async (tokens: Record<string, string>, rawState: unknown) => {
                try {
                    console.log('OAuth callback received tokens');
                    
                    const state = rawState as { account?: string } | null;
                    const accountsList: Record<string, string> = {};
                    const clientAccounts: Record<string, { loginid: string; token: string; currency: string }> = {};

                    for (const [key, value] of Object.entries(tokens)) {
                        if (key.startsWith('acct')) {
                            const tokenKey = key.replace('acct', 'token');
                            if (tokens[tokenKey]) {
                                accountsList[value] = tokens[tokenKey];
                                clientAccounts[value] = {
                                    loginid: value,
                                    token: tokens[tokenKey],
                                    currency: '',
                                };
                            }
                        } else if (key.startsWith('cur')) {
                            const accKey = key.replace('cur', 'acct');
                            if (tokens[accKey]) {
                                clientAccounts[tokens[accKey]].currency = value;
                            }
                        }
                    }

                    localStorage.setItem('accountsList', JSON.stringify(accountsList));
                    localStorage.setItem('clientAccounts', JSON.stringify(clientAccounts));

                    let is_token_set = false;
                    try {
                        const api = await generateDerivApiInstance();
                        if (api) {
                            const { authorize, error } = await api.authorize(tokens.token1);
                            api.disconnect();
                            if (error) {
                                console.error('API authorization error:', error);
                                // Check if the error is due to an invalid token
                                if (error.code === 'InvalidToken') {
                                    // Set is_token_set to true to prevent the app from getting stuck in loading state
                                    is_token_set = true;

                                    // Only emit the InvalidToken event if logged_state is true
                                    if (Cookies.get('logged_state') === 'true') {
                                        // Emit an event that can be caught by the application to retrigger OIDC authentication
                                        globalObserver.emit('InvalidToken', { error });
                                    }
                                    if (Cookies.get('logged_state') === 'false') {
                                        // If the user is not logged out, we need to clear the local storage
                                        clearAuthData();
                                    }
                                }
                            } else {
                                localStorage.setItem('callback_token', authorize.toString());
                                const clientAccountsArray = Object.values(clientAccounts);
                                const firstId = authorize?.account_list[0]?.loginid;
                                const filteredTokens = clientAccountsArray.filter(account => account.loginid === firstId);
                                if (filteredTokens.length) {
                                    localStorage.setItem('authToken', filteredTokens[0].token);
                                    localStorage.setItem('active_loginid', filteredTokens[0].loginid);
                                    is_token_set = true;
                                }
                            }
                        }
                    } catch (apiError) {
                        console.error('Error during API authorization:', apiError);
                    }

                    if (!is_token_set) {
                        localStorage.setItem('authToken', tokens.token1);
                        localStorage.setItem('active_loginid', tokens.acct1);
                    }
                    
                    // Determine the appropriate currency to use
                    const selected_currency = getSelectedCurrency(tokens, clientAccounts, state);

                    // Redirect to the main page with the selected currency
                    window.location.replace(window.location.origin + `/?account=${selected_currency}`);
                } catch (callbackError) {
                    console.error('Error processing OAuth callback:', callbackError);
                    setError('An unexpected error occurred while processing your login. Please try again.');
                }
            }}
            onSignInError={(error) => {
                console.error('OAuth sign-in error:', error);
                setError(`Authentication error: ${error.message || 'Unknown error'}`);
            }}
            renderReturnButton={() => {
                return (
                    <Button
                        className='callback-return-button'
                        onClick={() => {
                            window.location.href = '/';
                        }}
                    >
                        {'Return to Bot'}
                    </Button>
                );
            }}
        />
    );
};

export default CallbackPage;
