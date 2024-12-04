import * as Klatt from "./klatt.js";
import {Spectrogram} from "./spectrogram.js";

export function main() {
	// document.getElementById("overlay").style.display = "none";
	document.getElementById("overlay").style.animation = "overlay-fade 0.5s forwards";
	document.getElementById("overlay-text").style.animation = "overlay-text-shift 0.5s forwards, overlay-fade 0.5s forwards";

	let ctx = new AudioContext();
	let spectrogram = new Spectrogram(ctx, document.getElementById("spectrogram"));
	Klatt.init(ctx, spectrogram.analyzerNode);

	let soundButton = document.getElementById("make-sound-button");
	let ipaTextField = document.getElementById("ipa-text-input");
	let pitchSlider = document.getElementById("pitchRange");
	let speedSlider = document.getElementById("speedRange");

	spectrogram.start();
	// Klatt.playPhrase(ctx, "");

	soundButton.addEventListener("click", function (e) {
		e.preventDefault();
		spectrogram.start();
		let pitchMultiplier = (0.875 * (pitchSlider.value ** 2)) + (1.125 * pitchSlider.value) + 1;
		let durationMultiplier = (0.625 * (speedSlider.value ** 2)) - (1.375 * speedSlider.value) + 1;
		Klatt.playPhrase(ctx, ipaTextField.value, pitchMultiplier, durationMultiplier);
	});
}
