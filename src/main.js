import { VOWELS } from "./sound.js";

export function main() {
	let ctx = new AudioContext();

	for (const [ipa, vowel] of Object.entries(VOWELS)) {
		let button = document.createElement("button");
		button.innerText = ipa;
		button.addEventListener("click", function() {
			vowel.play(ctx, 1);
		});
		document.body.appendChild(button);
	}
}
