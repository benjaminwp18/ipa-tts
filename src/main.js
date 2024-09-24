import { playWord } from "./sound.js";

export function main() {

	//Activate initial keyboard tab
	document.getElementById("V").style.display = "block";

	let ctx = new AudioContext();

	let soundButton = document.getElementById("make-sound-button");
	let ipaTextField = document.getElementById("ipa-text");

	soundButton.addEventListener("click", function (e) {
		e.preventDefault();
		playWord(ctx, ipaTextField.value);
	});
}
