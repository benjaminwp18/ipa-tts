let linkedTextArea = document.getElementById("keyboard-linked"); //Text area linked to keyboard
let allKeys = document.getElementsByClassName("key");

//Add event listeners for all keyboard keys
for(let key of allKeys){
    key.addEventListener("click", keyType)
}

//function called by keyboard keys to type in linked text area
function keyType(evt){
    let content = linkedTextArea.value;
    content += evt.currentTarget.innerText;
    linkedTextArea.value = content;
    window.alert("Typed")
}

//function used by buttons controlling tabbed interface for keyboard
function openTab(evt, tabName) {
    let tabcontent = document.getElementsByClassName("tabcontent");
    let tablinks = document.getElementsByClassName("tablinks");
    //Hide all tabs
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    //Remove class active from all buttons
    tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    //Open activated tab and add class active to the button clicked
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}