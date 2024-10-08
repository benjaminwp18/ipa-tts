const linkedTextArea = document.getElementById("ipa-text-input"); // Text area linked to keyboard
const allKeys = document.getElementsByClassName("key");
const tabcontent = document.getElementsByClassName("tabcontent");
const tablinks = document.getElementsByClassName("tablinks");

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

// function used by buttons controlling tabbed interface for keyboard
function openTab(evt, tabName) {
    // Hide all tabs
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove("open");
    }
    // Remove class active from all buttons
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }
    // Open activated tab and add class active to the button clicked
    document.getElementById(tabName).classList.add("open");
    evt.currentTarget.classList.add("active");
}

function openPopup() {
    document.getElementById("popup").style.display = "block";
    document.querySelector(".popup-overlay").style.display = "block";
}

function closePopup() {
    document.getElementById("popup").style.display = "none";
    document.querySelector(".popup-overlay").style.display = "none";
}