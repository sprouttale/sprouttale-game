import React, { useState } from "react";
import { Language, LANGUAGES, getTranslation } from "../i18n/translations";
import "./LanguageSelect.css";

interface LanguageSelectProps {
  currentLanguage: Language;
  onSelectLanguage: (lang: Language) => void;
  onConfirm: () => void;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({
  currentLanguage,
  onSelectLanguage,
  onConfirm,
}) => {
  const [selectedLang, setSelectedLang] = useState<Language>(currentLanguage);

  const handleSelect = (lang: Language) => {
    setSelectedLang(lang);
    onSelectLanguage(lang);
  };

  return (
    <div className="lang-select-overlay">
      <div className="lang-select-box">
        <div className="lang-select-header">
          <div className="lang-select-title">
            🌐 {getTranslation(selectedLang, "selectLanguage")}
          </div>
          <div className="lang-select-subtitle">
            {getTranslation(selectedLang, "chooseLanguageDesc")}
          </div>
        </div>

        <div className="lang-grid">
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;
            return (
              <div
                key={lang.code}
                className={`lang-card ${isSelected ? "lang-card--selected" : ""}`}
                onClick={() => handleSelect(lang.code)}
              >
                <span className="lang-flag">{lang.flag}</span>
                <div className="lang-info">
                  <span className="lang-name">{lang.name}</span>
                  <span className="lang-native">{lang.nativeName}</span>
                </div>
                {isSelected && <span className="lang-check">✓</span>}
              </div>
            );
          })}
        </div>

        <button
          className="lang-confirm-btn"
          onClick={onConfirm}
        >
          {getTranslation(selectedLang, "continue")}
        </button>
      </div>
    </div>
  );
};
