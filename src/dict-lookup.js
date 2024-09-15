// \p{L} matches any letter from any language
// \p{M} matches character intended to be combined with another char (e.g. accents)
const NON_ALPHANUM_REGEX = /[^\p{L}|\p{M}|\d]+/ugm;

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
    const words = formattedPhrase.split(NON_ALPHANUM_REGEX);
    if (words.length > 1) {
        let entries = [];
        words.forEach(word => {
            const entry = currentDict.find(e => e.word === word);
            entry ? entries.push(entry) : entries.push({ word: word, ipa: null });
        });
        return entries;
    }

    return [{ word: phrase, ipa: null }];
}

async function translateIpa(phrase, lang) {
    if (!currentDict || currentLang !== lang) {
        await loadDict(lang);
        currentLang = lang;
    }

    const entries = await findEntries(phrase, lang);
    const wordsNotFound = entries.filter(entry => entry.ipa === null).map(entry => entry.word);
    if (wordsNotFound.length > 0) {
        return `The following word(s) were not found: ${wordsNotFound.join(', ')}`;
    }
    else {
        return entries.map(entry => entry.ipa).join(' ');
    }
}
