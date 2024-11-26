import * as Klatt from "./klatt.js";
import {Spectrogram} from "./spectrogram.js";

export function main() {
	
	// document.getElementById("overlay").style.display = "none";
	document.getElementById("overlay").style.animation = "overlay-fade 0.5s forwards";
	document.getElementById("overlay-text").style.animation = "overlay-text-shift 0.5s forwards, overlay-fade 0.5s forwards";


	//  Activate initial keyboard tab
	document.getElementById("V").classList.add("open");
	document.getElementById("button-v").classList.add("active");

	let ctx = new AudioContext();
	let spectrogram = new Spectrogram(ctx, document.getElementById("spectrogram"));
	Klatt.init(ctx, spectrogram.analyzerNode);


	let soundButton = document.getElementById("make-sound-button");
	let ipaTextField = document.getElementById("ipa-text-input");

	soundButton.addEventListener("click", function (e) {
		e.preventDefault();
		spectrogram.start();
		Klatt.playWord(ctx, ipaTextField.value);
	});
}
