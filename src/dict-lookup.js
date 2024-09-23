// \p{L} matches any letter from any language
// \p{M} matches character intended to be combined with another char (e.g. accents)
const NON_ALPHABET_REGEX = /[^\p{L}|\p{M}]+/ugm; // TODO: include hyphen? apostrophe?

let currentLang;
let currentDict;

function generateDictUrl(lang) {
    return `https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/${lang}.txt`;
}

function parseDict(text) {
    const rows = text.trim().split('\n');
    return rows.map(row => {
        const columns = row.split('\t');
        return {
            word: columns[0],
            ipa: columns[1].split(',')[0] // use first provided IPA
        };
    });
}

async function loadDict(lang) {
    const response = await fetch(generateDictUrl(lang));
    if (!response.ok) {
        throw new Error(`Status ${response.status}`);
    }
    const text = await response.text();
    currentDict = parseDict(text);
}

function findEntries(phrase) {
    const formattedPhrase = phrase.trim().toLowerCase();

    // first try entire phrase
    const entry = currentDict.find(e => e.word === formattedPhrase);
    if (entry)
        return [entry];

    // if that doesn't work, try splitting phrase
    const words = formattedPhrase
        .split(NON_ALPHABET_REGEX)
        .filter(Boolean); // remove empty strings
    let entries = [];
    words.forEach(word => {
        const entry = currentDict.find(e => e.word === word);
        entry ? entries.push(entry) : entries.push({ word: word, ipa: null });
    });
    return entries;
}

/**
 * Attempts to translates the phrase in the given language using an online IPA dict
 * (https://github.com/open-dict-data/ipa-dict)
 * @param   {string} phrase    A phrase to be translated
 * @param   {string} lang      The language code (e.g. en_US, fr_FR, de)
 * @returns {Promise<Object>}  Contains status and relevant details
 *   - status (string)                   SUCCESS, NOT_FOUND, NO_VALID_WORD, or HTTP_ERROR
 *   - ipas (Array<string>, optional)    Translated words if SUCCESS
 *   - words (Array<string>, optional)   Words not found if NOT_FOUND
 *   - details (string, optional)        Error message if HTTP_ERROR
 */
export async function translateIpa(phrase, lang) {
    if (!currentDict || currentLang !== lang) {
        try {
            await loadDict(lang);
            currentLang = lang;
        } catch (error) {
            return {
                status: 'HTTP_ERROR',
                details: `Could not load dictionary for ${lang}: ${error.message}`
            };
        }
    }

    const entries = findEntries(phrase, lang);
    if (entries.length === 0) {
        return { status: 'NO_VALID_WORD' };
    }

    const wordsNotFound = entries.filter(entry => !entry.ipa).map(entry => entry.word);
    if (wordsNotFound.length > 0) {
        return {
            status: 'NOT_FOUND',
            words: wordsNotFound
        };
    } else {
        return {
            status: 'SUCCESS',
            ipas: entries.map(entry => entry.ipa)
        }
    }
}
