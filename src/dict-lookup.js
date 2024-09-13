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

async function findWord(wordToFind, lang) {
    if (!currentDict || currentLang !== lang) {
        await loadDict(lang);
        currentLang = lang;
    }
    const entry = currentDict.find(entry => entry.word === wordToFind);
    return entry;
}
