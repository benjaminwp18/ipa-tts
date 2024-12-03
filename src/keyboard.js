const linkedTextArea = document.getElementById("ipa-text-input"); // Text area linked to keyboard
const allKeys = document.getElementsByClassName("key");

// Add event listeners for all keyboard keys
for (let key of allKeys) {
    key.addEventListener("click", keyType)
}

// function called by keyboard keys to type in linked text area
function keyType(evt) {
    let content = linkedTextArea.value;
    content += evt.currentTarget.innerText;
    linkedTextArea.value = content;
}
