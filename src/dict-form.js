import { translateIpa } from './dict-lookup.js';

const SUPPORTED_LANGUAGES = {
    "ar": 	    "Arabic (Modern Standard)",
    "de": 	    "German",
    "en_UK": 	"English (Received Pronunciation)",
    "en_US": 	"English (General American)",
    "eo": 	    "Esperanto",
    "es_ES": 	"Spanish (Spain)",
    "es_MX": 	"Spanish (Mexico)",
    "fa": 	    "Persian",
    "fi": 	    "Finnish",
    "fr_FR": 	"French (France)",
    "fr_QC": 	"French (Québec)",
    "is": 	    "Icelandic",
    "ja": 	    "Japanese",
    "jam": 	    "Jamaican Creole",
    "km": 	    "Khmer",
    "ko": 	    "Korean",
    "ma": 	    "Malay (Malaysian and Indonesian)",
    "nb": 	    "Norwegian Bokmål",
    "nl": 	    "Dutch",
    "or": 	    "Odia",
    "ro": 	    "Romanian",
    "sv": 	    "Swedish",
    "sw": 	    "Swahili",
    "tts": 	    "Isan",
    "vi_C": 	"Vietnamese (Central)",
    "vi_N": 	"Vietnamese (Northern)",
    "vi_S": 	"Vietnamese (Southern)",
    "yue": 	    "Cantonese",
    "zh": 	    "Mandarin"
}

const languageSelection = document.getElementById("language-selection");
const textInput = document.getElementById("text");
const warningLabel = document.getElementById("language-selection-warning");
const ipaToSoundInput = document.getElementById("ipa-text");

const ipaLookupForm = document.getElementById("ipa-lookup-form");
ipaLookupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await ipaLookupOnSubmit();
})

const sortedEntries = Object.entries(SUPPORTED_LANGUAGES)
    .sort((a, b) => a[1].localeCompare(b[1]));
const sortedLanguages = Object.fromEntries(sortedEntries);
for (const [langCode, langName] of Object.entries(sortedLanguages)) {
    const opt = document.createElement("option");
    opt.value = langCode;
    opt.innerHTML = langName;
    languageSelection.appendChild(opt);
}

async function ipaLookupOnSubmit() {
    warningLabel.innerHTML = "";
    const langCode = languageSelection.value;
    if (langCode === "default") {
        warningLabel.innerHTML = "Please select a language";
        return;
    }
    const textToTranslate = textInput.value;
    const translateResult = await translateIpa(textToTranslate, langCode);
    switch (translateResult.status) {
        case "SUCCESS":
            ipaToSoundInput.value = translateResult.ipas.join(" ");
            break;
        case "NOT_FOUND":
            warningLabel.innerHTML = "No IPA translation available. Please try again";
            break;
        case "NO_VALID_WORD":
            warningLabel.innerHTML = "Please type a word or phrase to be translated";
            break;
        case "HTTP_ERROR":
            warningLabel.innerHTML = "An error has occurred on our end. Please try again later";
            break;
    }
}