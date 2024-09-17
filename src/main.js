import { VOWELS } from "./sound.js";

const soundTestingArea = document.getElementById('sound-testing-area');

export function main() {
	let ctx = new AudioContext();

	for (const [ipa, vowel] of Object.entries(VOWELS)) {
		let button = document.createElement("button");
		button.innerText = ipa;
		button.addEventListener("click", function() {
			vowel.play(ctx, 1);
		});
		soundTestingArea.appendChild(button);
	}
}
