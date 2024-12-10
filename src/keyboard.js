const linkedTextArea = document.getElementById("ipa-text-input"); // Text area linked to keyboard
const allKeys = document.getElementsByClassName("key");

// Add event listeners for all keyboard keys
for (let key of allKeys) {
    key.addEventListener("click", keyType)
}

// function called by keyboard keys to type in linked text area
function keyType(evt) {
    let content = linkedTextArea.value;
    const selStart = linkedTextArea.selectionStart;
    const selEnd = linkedTextArea.selectionEnd;
    const keyChar = evt.currentTarget.innerText;

    content = content.slice(0, selStart) + keyChar + content.slice(selEnd);
    linkedTextArea.value = content;
    linkedTextArea.focus();
    linkedTextArea.setSelectionRange(selStart + 1, selStart + 1);
}
