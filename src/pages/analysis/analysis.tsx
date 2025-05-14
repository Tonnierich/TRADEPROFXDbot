// src/pages/analysis/analysis.tsx
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Localize } from '@deriv-com/translations';
import './analysis.scss';

const Analysis = observer(() => {
    const [showTool, setShowTool] = useState(true);

    const toggleTool = () => {
        setShowTool(!showTool);
    };

    return (
        <div className="analysis">
            <div className="analysis__compact-header">
                <h2 className="analysis__title">
                    <Localize i18n_default_text="Analysis Tools" />
                </h2>
                {showTool && (
                    <button className="analysis__toggle-button" onClick={toggleTool}>
                        <Localize i18n_default_text="Hide Tool" />
                    </button>
                )}
            </div>

            {showTool ? (
                <div className="analysis__centered-container">
                    <div className="analysis__iframe-wrapper">
                        <iframe
                            src="https://v0-convert-to-react-eta.vercel.app/"
                            className="analysis__iframe"
                            title="TRADEPROFX Analysis Tool"
                            allow="fullscreen"
                            scrolling="no"
                        />
                    </div>
                </div>
            ) : (
                <div className="analysis__card">
                    <div className="analysis__card-header">
                        <h4 className="analysis__card-title">
                            <Localize i18n_default_text="TRADEPROFX Tick Analysis Tool" />
                        </h4>
                    </div>
                    <div className="analysis__card-content">
                        <p>
                            <Localize i18n_default_text="Click to open our advanced trading analysis tool with real-time market data and digit analysis." />
                        </p>
                        <button className="analysis__button" onClick={toggleTool}>
                            <Localize i18n_default_text="Show Tool" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

export default Analysis;